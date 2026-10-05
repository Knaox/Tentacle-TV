import { jellyfinTokenAuth } from "../../services/jellyfinAuth";
import { SetupError } from "../setupErrors";
import type { BrowseEntry, BrowseResult, ExistingLibrary, LibraryOutcome, LibraryPlan } from "../setupWizardContract";
import { jellyfinRequest } from "./guardedFetch";

/**
 * Les bibliothèques, et le parcours des dossiers — ceux que JELLYFIN voit
 * (dans son conteneur : `/media`), pas ceux de Tentacle. Tout passe par la clé
 * « Tentacle ». Routes relues dans le source de Jellyfin 10.10.7, 10.11.11 et
 * 12.1 (`LibraryStructureController`, `EnvironmentController`).
 */
const BROWSE_LIMIT = 500;

function auth(apiKey: string): string {
  return jellyfinTokenAuth(apiKey);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function listLibraries(url: string, apiKey: string): Promise<ExistingLibrary[]> {
  const reply = await jellyfinRequest(url, "/Library/VirtualFolders", { authorization: auth(apiKey), maxBytes: 1024 * 1024 });
  if (reply.status === 401 || reply.status === 403) throw new SetupError("jf_api_key_invalid");
  if (reply.status !== 200 || !Array.isArray(reply.json)) throw new SetupError("jf_library_failed");
  return reply.json.slice(0, 100).flatMap((folder: { Name?: unknown; CollectionType?: unknown; Locations?: unknown }) =>
    typeof folder?.Name === "string"
      ? [{ name: folder.Name, type: typeof folder.CollectionType === "string" ? folder.CollectionType : null, paths: stringList(folder.Locations) }]
      : [],
  );
}

function readEntries(json: unknown): BrowseEntry[] {
  if (!Array.isArray(json)) return [];
  return json
    .flatMap((entry: { Name?: unknown; Path?: unknown }) =>
      typeof entry?.Name === "string" && typeof entry.Path === "string" ? [{ name: entry.Name, path: entry.Path }] : [],
    )
    .slice(0, BROWSE_LIMIT);
}

/** `path` nul : la racine (les lecteurs sous Windows, `/` ailleurs). */
export async function browseDirectory(url: string, apiKey: string, path: string | null): Promise<BrowseResult> {
  const authorization = auth(apiKey);
  if (path === null) {
    const drives = await jellyfinRequest(url, "/Environment/Drives", { authorization });
    if (drives.status !== 200) throw new SetupError("jf_unreachable");
    return { path: null, parent: null, entries: readEntries(drives.json) };
  }
  const contents = await jellyfinRequest(url, "/Environment/DirectoryContents", {
    query: { path, includeDirectories: true, includeFiles: false },
    authorization,
    timeoutMs: 15_000,
    maxBytes: 4 * 1024 * 1024,
  });
  if (contents.status >= 400 && contents.status < 500) throw new SetupError("jf_path_not_found");
  if (contents.status !== 200) throw new SetupError("jf_unreachable");
  // Le parent selon Jellyfin : il sait lire `D:\Films` comme `/media/films`.
  const parentReply = await jellyfinRequest(url, "/Environment/ParentPath", { query: { path }, authorization });
  const parent = typeof parentReply.json === "string" && parentReply.json ? parentReply.json : null;
  return { path, parent, entries: readEntries(contents.json) };
}

async function ensureDirectory(url: string, authorization: string, path: string): Promise<void> {
  const reply = await jellyfinRequest(url, "/Environment/ValidatePath", {
    method: "POST",
    body: { Path: path, ValidateWritable: false, IsFile: false },
    authorization,
  });
  if (reply.status === 404 || reply.status === 400) throw new SetupError("jf_path_not_found");
  if (reply.status < 200 || reply.status >= 300) throw new SetupError("jf_library_failed");
}

export interface LibraryLocale {
  metadataLanguage: string;
  metadataCountry: string;
}

/**
 * Crée ce qui manque. Une bibliothèque du même nom est laissée telle quelle
 * (« exists ») : Jellyfin en créerait sinon une seconde, « Films2 ». Les
 * chemins vont dans le corps (`LibraryOptions.PathInfos`) — la liste de
 * l'URL est séparée par des virgules, qu'un nom de dossier peut contenir.
 * Un seul scan à la fin, pas un par bibliothèque.
 */
export async function createLibraries(url: string, apiKey: string, plans: LibraryPlan[], locale: LibraryLocale): Promise<LibraryOutcome[]> {
  const authorization = auth(apiKey);
  const existing = new Set((await listLibraries(url, apiKey)).map((library) => library.name.toLowerCase()));
  const outcomes: LibraryOutcome[] = [];

  for (const plan of plans) {
    if (existing.has(plan.name.toLowerCase())) {
      outcomes.push({ name: plan.name, status: "exists" });
      continue;
    }
    try {
      for (const path of plan.paths) await ensureDirectory(url, authorization, path);
      const reply = await jellyfinRequest(url, "/Library/VirtualFolders", {
        method: "POST",
        // « Mixte » : sans type, comme le fait Jellyfin pour un contenu mêlé.
        query: { name: plan.name, collectionType: plan.type === "mixed" ? undefined : plan.type, refreshLibrary: false },
        body: {
          LibraryOptions: {
            PathInfos: plan.paths.map((path) => ({ Path: path })),
            PreferredMetadataLanguage: locale.metadataLanguage,
            MetadataCountryCode: locale.metadataCountry,
            EnableRealtimeMonitor: true,
          },
        },
        authorization,
        timeoutMs: 30_000,
      });
      if (reply.status < 200 || reply.status >= 300) throw new SetupError("jf_library_failed");
      existing.add(plan.name.toLowerCase());
      outcomes.push({ name: plan.name, status: "created" });
    } catch (err) {
      outcomes.push({ name: plan.name, status: "failed", error: err instanceof SetupError ? err.code : "jf_library_failed" });
    }
  }

  if (outcomes.some((outcome) => outcome.status === "created")) {
    await jellyfinRequest(url, "/Library/Refresh", { method: "POST", authorization }).catch(() => undefined);
  }
  return outcomes;
}
