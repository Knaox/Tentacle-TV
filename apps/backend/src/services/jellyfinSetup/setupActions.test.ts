/**
 * Les gestes en un clic, contre un faux Jellyfin qui garde ses options comme
 * le vrai : chaque écriture est un REMPLACEMENT intégral. On vérifie qu'on lui
 * renvoie l'objet complet, un seul champ changé, puis qu'on relit.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ config: new Map<string, string>() }));

vi.mock("../configStore", () => ({
  getJellyfinUrl: () => env.config.get("jellyfin_url"),
  getJellyfinApiKey: () => env.config.get("jellyfin_api_key"),
}));

import { applySetupAction } from "./setupActions";

type Loose = Record<string, unknown>;

interface FakeJellyfin {
  libraries: Loose[];
  config: Loose;
  plugins: Loose[];
  started: string[];
  posts: Array<{ path: string; body: unknown }>;
  /** Simule un Jellyfin qui répond 204 sans rien enregistrer. */
  ignoreWrites: boolean;
}

let jf: FakeJellyfin;

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const empty = () => new Response(null, { status: 204 });

const fake = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  const method = init?.method ?? "GET";
  if ((init?.headers as Record<string, string>).Authorization !== 'MediaBrowser Token="cle"') return new Response("", { status: 401 });
  const body = init?.body ? (JSON.parse(String(init.body)) as Loose) : undefined;
  if (method === "POST") jf.posts.push({ path: url.pathname + url.search, body });
  switch (`${method} ${url.pathname}`) {
    case "GET /Library/VirtualFolders":
      return json(jf.libraries);
    case "POST /Library/VirtualFolders/LibraryOptions": {
      const target = jf.libraries.find((l) => l.ItemId === body?.Id);
      if (target && !jf.ignoreWrites) target.LibraryOptions = body?.LibraryOptions;
      return empty();
    }
    case "GET /System/Configuration":
      return json(jf.config);
    case "POST /System/Configuration":
      if (!jf.ignoreWrites) jf.config = body ?? {};
      return empty();
    case "POST /Packages/Installed/Chapter%20Segments%20Provider":
      jf.plugins.push({ Name: "Chapter Segments Provider", Status: "Restart" });
      return empty();
    case "GET /Plugins":
      return json(jf.plugins);
    case "GET /ScheduledTasks":
      return json([{ Key: "RefreshTrickplayImages", Id: "trick" }, { Key: "TaskExtractMediaSegments", Id: "seg" }, { Key: "RefreshLibrary", Id: "scan" }]);
    default:
      if (method === "POST" && url.pathname.startsWith("/ScheduledTasks/Running/")) {
        jf.started.push(url.pathname.split("/").pop() ?? "");
        return empty();
      }
      return new Response("", { status: 404 });
  }
});

beforeEach(() => {
  env.config.set("jellyfin_url", "http://jf.test");
  env.config.set("jellyfin_api_key", "cle");
  jf = {
    libraries: [
      { Name: "Films", CollectionType: "movies", ItemId: "films", LibraryOptions: { EnableTrickplayImageExtraction: true, SeasonZeroDisplayName: "Spéciaux", TypeOptions: [{ Type: "Movie" }] } },
      { Name: "Séries", CollectionType: "tvshows", ItemId: "series", LibraryOptions: { EnableTrickplayImageExtraction: false, SaveLocalMetadata: true } },
      { Name: "Musique", CollectionType: "music", ItemId: "music", LibraryOptions: { EnableTrickplayImageExtraction: false } },
    ],
    config: { PreferredMetadataLanguage: "", MetadataCountryCode: "", ServerName: "Maison", MaxResumePct: 90 },
    plugins: [{ Name: "TMDb", Status: "Active" }],
    started: [],
    posts: [],
    ignoreWrites: false,
  };
  vi.stubGlobal("fetch", fake);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fake.mockClear();
  env.config.clear();
});

describe("gestes en un clic", () => {
  it("trickplay : seules les bibliothèques vidéo qui ne l'ont pas, avec TOUTES leurs options", async () => {
    expect(await applySetupAction({ action: "enableTrickplay" })).toEqual({ ok: true, changed: 1 });
    expect(jf.posts).toEqual([
      {
        path: "/Library/VirtualFolders/LibraryOptions",
        body: { Id: "series", LibraryOptions: { EnableTrickplayImageExtraction: true, SaveLocalMetadata: true } },
      },
    ]);
    expect(jf.libraries.find((l) => l.ItemId === "music")?.LibraryOptions).toEqual({ EnableTrickplayImageExtraction: false });
  });

  it("surveillance en temps réel : toutes les bibliothèques vidéo qui ne l'ont pas", async () => {
    expect(await applySetupAction({ action: "enableRealtimeMonitor" })).toEqual({ ok: true, changed: 2 });
    expect(jf.libraries.filter((l) => l.CollectionType !== "music").every((l) => (l.LibraryOptions as Loose).EnableRealtimeMonitor === true)).toBe(true);
  });

  it("une écriture que Jellyfin n'enregistre pas est un échec, pas un succès silencieux", async () => {
    jf.ignoreWrites = true;
    expect(await applySetupAction({ action: "enableTrickplay" })).toEqual({ ok: false, error: "not-applied" });
  });

  it("langue des métadonnées : la configuration entière repart, deux champs changés", async () => {
    expect(await applySetupAction({ action: "setMetadataLanguage", language: "fr", country: "FR" })).toEqual({ ok: true, changed: 1 });
    expect(jf.config).toEqual({ PreferredMetadataLanguage: "fr", MetadataCountryCode: "FR", ServerName: "Maison", MaxResumePct: 90 });
  });

  it("langue ou pays hors format : refusé avant tout appel", async () => {
    for (const [language, country] of [["français", "FR"], ["fr", "France"], [undefined, "FR"], ["fr", undefined]]) {
      expect(await applySetupAction({ action: "setMetadataLanguage", language, country })).toEqual({ ok: false, error: "bad-request" });
    }
    expect(fake).not.toHaveBeenCalled();
  });

  it("greffon officiel de passages : installé par le catalogue, vérifié dans la liste des greffons", async () => {
    expect(await applySetupAction({ action: "installChapterSegments" })).toEqual({ ok: true, changed: 1 });
    expect(jf.posts[0].path).toBe("/Packages/Installed/Chapter%20Segments%20Provider?assemblyGuid=698b6f3314ca49b59d79fc3c0ab941f5");
  });

  it("les deux tâches connues se lancent, et elles seules", async () => {
    await applySetupAction({ action: "generateTrickplay" });
    await applySetupAction({ action: "scanMediaSegments" });
    expect(jf.started).toEqual(["trick", "seg"]);
    expect(await applySetupAction({ action: "RefreshLibrary" as never })).toEqual({ ok: false, error: "bad-request" });
  });

  it("sans Jellyfin configuré : rien ne part", async () => {
    env.config.clear();
    expect(await applySetupAction({ action: "enableTrickplay" })).toEqual({ ok: false, error: "not-configured" });
    expect(fake).not.toHaveBeenCalled();
  });

  it("un geste à la fois", async () => {
    const first = applySetupAction({ action: "enableRealtimeMonitor" });
    expect(await applySetupAction({ action: "enableTrickplay" })).toEqual({ ok: false, error: "busy" });
    await first;
  });
});
