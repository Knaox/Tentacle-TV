import { jellyfinAdminFetch, type JellyfinFailure } from "../jellyfinAdminFetch";
import type { SetupApplyRequest } from "../jellyfinCompat/setupContract";
import { CHAPTER_SEGMENTS } from "./segmentProviders";
import { TASK_KEYS, isVideoLibrary } from "./setupChecks";
import { forgetTrailerCoverage } from "./trailerCoverage";
import type { Loose } from "./setupSnapshot";

/**
 * Les gestes en un clic de la page — ceux que l'API de Jellyfin permet sans
 * risque. Une liste FERMÉE : rien dans le corps d'une requête ne choisit un
 * autre champ, une autre tâche ou un autre greffon.
 *
 * Chaque écriture de configuration de Jellyfin est un REMPLACEMENT intégral
 * (options d'une bibliothèque, configuration du serveur) : on relit l'objet
 * complet, on change UN champ, on renvoie tout, puis on RELIT pour vérifier —
 * mesuré sur 10.11.8 et 12.1.0 : l'aller-retour ne change rien d'autre.
 *
 * Jamais de redémarrage de Jellyfin d'ici : il couperait toutes les lectures
 * en cours, et dans Docker un conteneur sans politique de relance ne revient
 * pas. Un greffon installé attend donc que l'administrateur redémarre.
 */

export type ApplyError = JellyfinFailure | "bad-request" | "busy" | "not-applied";
export type ApplyOutcome = { ok: true; changed: number } | { ok: false; error: ApplyError };

const isRecord = (value: unknown): value is Loose => typeof value === "object" && value !== null && !Array.isArray(value);
const fail = (error: ApplyError): ApplyOutcome => ({ ok: false, error });

type LibraryFlag = "EnableTrickplayImageExtraction" | "EnableRealtimeMonitor";

async function videoLibraries(): Promise<Loose[] | ApplyError> {
  const res = await jellyfinAdminFetch("/Library/VirtualFolders", { timeoutMs: 8000 });
  if (!res.ok) return res.failure;
  return Array.isArray(res.data) ? res.data.filter(isRecord).filter(isVideoLibrary) : "invalid";
}

const optionsOf = (library: Loose): Loose => (isRecord(library.LibraryOptions) ? library.LibraryOptions : {});

async function enableLibraryFlag(key: LibraryFlag): Promise<ApplyOutcome> {
  const libraries = await videoLibraries();
  if (typeof libraries === "string") return fail(libraries);
  const targets = libraries.filter((library) => optionsOf(library)[key] !== true && typeof library.ItemId === "string");
  for (const library of targets) {
    const res = await jellyfinAdminFetch("/Library/VirtualFolders/LibraryOptions", {
      method: "POST",
      body: { Id: library.ItemId, LibraryOptions: { ...optionsOf(library), [key]: true } },
      expectEmpty: true,
      timeoutMs: 8000,
    });
    if (!res.ok) return fail(res.failure);
  }
  const after = await videoLibraries();
  if (typeof after === "string") return fail(after);
  const ids = new Set(targets.map((library) => library.ItemId));
  const applied = after.filter((library) => ids.has(library.ItemId)).every((library) => optionsOf(library)[key] === true);
  return applied ? { ok: true, changed: targets.length } : fail("not-applied");
}

const LANGUAGE_RE = /^[a-z]{2,3}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;

async function setMetadataLanguage(language: string | undefined, country: string | undefined): Promise<ApplyOutcome> {
  if (!language || !country || !LANGUAGE_RE.test(language) || !COUNTRY_RE.test(country)) return fail("bad-request");
  const current = await jellyfinAdminFetch("/System/Configuration");
  if (!current.ok) return fail(current.failure);
  if (!isRecord(current.data)) return fail("invalid");
  const res = await jellyfinAdminFetch("/System/Configuration", {
    method: "POST",
    body: { ...current.data, PreferredMetadataLanguage: language, MetadataCountryCode: country },
    expectEmpty: true,
  });
  if (!res.ok) return fail(res.failure);
  const after = await jellyfinAdminFetch("/System/Configuration");
  if (!after.ok) return fail(after.failure);
  const saved = isRecord(after.data) && after.data.PreferredMetadataLanguage === language && after.data.MetadataCountryCode === country;
  return saved ? { ok: true, changed: 1 } : fail("not-applied");
}

/** Le greffon officiel de passages par chapitres — au catalogue que Jellyfin configure par défaut. */
async function installChapterSegments(): Promise<ApplyOutcome> {
  const name = encodeURIComponent(CHAPTER_SEGMENTS.packageName);
  // Sans version : Jellyfin prend la dernière compatible avec lui-même.
  const res = await jellyfinAdminFetch(`/Packages/Installed/${name}?assemblyGuid=${CHAPTER_SEGMENTS.assemblyGuid}`, {
    method: "POST",
    expectEmpty: true,
    timeoutMs: 30_000,
  });
  if (!res.ok) return fail(res.failure);
  const plugins = await jellyfinAdminFetch("/Plugins");
  if (!plugins.ok) return fail(plugins.failure);
  const installed = Array.isArray(plugins.data) && plugins.data.some((plugin) => isRecord(plugin) && /chapter\s*segments/i.test(String(plugin.Name)));
  return installed ? { ok: true, changed: 1 } : fail("not-applied");
}

/** Lance une tâche planifiée de Jellyfin — seulement l'une des deux que la page connaît. */
async function runTask(key: string): Promise<ApplyOutcome> {
  const tasks = await jellyfinAdminFetch("/ScheduledTasks?isHidden=false");
  if (!tasks.ok) return fail(tasks.failure);
  const task = Array.isArray(tasks.data) ? tasks.data.filter(isRecord).find((candidate) => candidate.Key === key) : undefined;
  if (!task || typeof task.Id !== "string") return fail("not-applied");
  const res = await jellyfinAdminFetch(`/ScheduledTasks/Running/${encodeURIComponent(task.Id)}`, { method: "POST", expectEmpty: true });
  return res.ok ? { ok: true, changed: 1 } : fail(res.failure);
}

/**
 * « Rechercher les métadonnées manquantes », comme le propose le tableau de
 * bord de Jellyfin : chaque bibliothèque vidéo relue en profondeur, SANS rien
 * remplacer de ce qui existe (`ReplaceAllMetadata=false`) — seuls les champs
 * vides se remplissent, bandes-annonces comprises. Jellyfin met le travail en
 * file ; son avancement se lit dans `RefreshStatus`.
 */
async function refreshMissingMetadata(): Promise<ApplyOutcome> {
  const libraries = await videoLibraries();
  if (typeof libraries === "string") return fail(libraries);
  const query = "Recursive=true&MetadataRefreshMode=FullRefresh&ImageRefreshMode=Default&ReplaceAllMetadata=false&ReplaceAllImages=false";
  let queued = 0;
  for (const library of libraries) {
    if (typeof library.ItemId !== "string") continue;
    const res = await jellyfinAdminFetch(`/Items/${encodeURIComponent(library.ItemId)}/Refresh?${query}`, { method: "POST", expectEmpty: true });
    if (!res.ok) return fail(res.failure);
    queued += 1;
  }
  forgetTrailerCoverage();
  return queued > 0 ? { ok: true, changed: queued } : fail("not-applied");
}

let busy = false;

/** Un geste à la fois : deux écritures d'options croisées se remplaceraient l'une l'autre. */
export async function applySetupAction(request: SetupApplyRequest): Promise<ApplyOutcome> {
  if (busy) return fail("busy");
  busy = true;
  try {
    switch (request.action) {
      case "enableTrickplay":
        return await enableLibraryFlag("EnableTrickplayImageExtraction");
      case "enableRealtimeMonitor":
        return await enableLibraryFlag("EnableRealtimeMonitor");
      case "setMetadataLanguage":
        return await setMetadataLanguage(request.language, request.country);
      case "installChapterSegments":
        return await installChapterSegments();
      case "generateTrickplay":
        return await runTask(TASK_KEYS.trickplay);
      case "scanMediaSegments":
        return await runTask(TASK_KEYS.segments);
      case "refreshMissingMetadata":
        return await refreshMissingMetadata();
      default:
        return fail("bad-request");
    }
  } finally {
    busy = false;
  }
}
