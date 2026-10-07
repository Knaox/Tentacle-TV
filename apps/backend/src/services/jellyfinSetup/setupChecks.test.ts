/**
 * Les réglages recommandés, jugés sur des formes RELEVÉES sur Jellyfin 12.1.0
 * et 10.11.8 (instances jetables, 2026-09-29) : bibliothèques et options,
 * greffons, configuration, transcodage, tâches.
 */

import { describe, expect, it } from "vitest";
import type { SetupCheck, SetupCheckId } from "../jellyfinCompat/setupContract";
import { evaluateSetup, isVideoLibrary } from "./setupChecks";
import type { SetupSnapshot } from "./setupSnapshot";

const library = (Name: string, CollectionType: string | null, options: Record<string, unknown> = {}) => ({
  Name,
  CollectionType,
  ItemId: `id-${Name}`,
  LibraryOptions: {
    EnableTrickplayImageExtraction: false,
    EnableRealtimeMonitor: false,
    EnableChapterImageExtraction: false,
    TypeOptions: [],
    ...options,
  },
});

const PLUGINS_12_1 = ["AudioDB", "ListenBrainz Similarity Provider", "MusicBrainz", "OMDb", "Studio Images", "TMDb"].map((Name) => ({
  Name,
  Status: "Active",
  Id: Name === "TMDb" ? "b8715ed16c4745289ad3f72deb539cd4" : `id-${Name}`,
}));

function snapshot(patch: Partial<SetupSnapshot> = {}): SetupSnapshot {
  return {
    version: "12.1.0",
    restartPending: false,
    libraries: [library("Films", "movies", { EnableTrickplayImageExtraction: true }), library("Séries", "tvshows")],
    plugins: PLUGINS_12_1,
    config: { PreferredMetadataLanguage: "fr", MetadataCountryCode: "FR" },
    encoding: { HardwareAccelerationType: "none" },
    tasks: [
      { Key: "RefreshTrickplayImages", Id: "t-trick", State: "Idle", CurrentProgressPercentage: null, LastExecutionResult: null },
      {
        Key: "TaskExtractMediaSegments",
        Id: "t-seg",
        State: "Running",
        CurrentProgressPercentage: 41.7,
        LastExecutionResult: { EndTimeUtc: "2026-09-29T11:06:51Z", Status: "Completed" },
      },
    ],
    missingTmdb: 1,
    trailers: { titles: 4, withTmdb: 3, withTrailer: 1, sampled: false },
    ...patch,
  };
}

function check(checks: SetupCheck[], id: SetupCheckId): SetupCheck {
  const found = checks.find((c) => c.id === id);
  if (!found) throw new Error(`réglage ${id} absent`);
  return found;
}

describe("bibliothèques concernées", () => {
  it("films, séries et la mixte (sans type) — pas la musique ni les livres", () => {
    expect(isVideoLibrary({ CollectionType: "movies" })).toBe(true);
    expect(isVideoLibrary({ CollectionType: "TvShows" })).toBe(true);
    expect(isVideoLibrary({ CollectionType: null })).toBe(true);
    expect(isVideoLibrary({ CollectionType: "music" })).toBe(false);
    expect(isVideoLibrary({ CollectionType: "books" })).toBe(false);
  });
});

describe("réglages recommandés", () => {
  it("rend les dix réglages, dans l'ordre de la page", () => {
    expect(evaluateSetup(snapshot()).map((c) => c.id)).toEqual([
      "metadataTmdb", "metadataLanguage", "trailers", "trickplay", "segmentsProvider", "realtimeMonitor", "libraryUpdateDelay",
      "hardwareAcceleration", "hevcEncoding", "chapterImages",
    ]);
  });

  it("annonce des ajouts : à faire au-delà de 10 s (30 par défaut), le geste la ramène à 5 ; un Jellyfin muet reste inconnu", () => {
    const delay = (seconds?: unknown) =>
      check(evaluateSetup(snapshot({ config: { PreferredMetadataLanguage: "fr", MetadataCountryCode: "FR", LibraryUpdateDuration: seconds } })), "libraryUpdateDelay");
    expect(delay(30)).toMatchObject({ state: "todo", level: "recommended", current: "30 s", action: "shortenLibraryUpdateDelay" });
    expect(delay(10)).toMatchObject({ state: "done", current: "10 s", action: null });
    expect(delay(5)).toMatchObject({ state: "done", current: "5 s", action: null });
    expect(delay(undefined)).toMatchObject({ state: "unknown", current: null, action: null });
  });

  it("trickplay : à faire tant qu'une bibliothèque vidéo ne l'a pas, et le geste l'active", () => {
    const trickplay = check(evaluateSetup(snapshot()), "trickplay");
    expect(trickplay).toMatchObject({ state: "todo", action: "enableTrickplay", dashboardPath: "/web/#/dashboard/libraries" });
    expect(trickplay.libraries?.map((l) => [l.name, l.enabled])).toEqual([["Films", true], ["Séries", false]]);
  });

  it("trickplay réglé partout : fait, et la génération se lance d'un clic", () => {
    const libraries = [library("Films", "movies", { EnableTrickplayImageExtraction: true })];
    expect(check(evaluateSetup(snapshot({ libraries })), "trickplay")).toMatchObject({ state: "done", action: "generateTrickplay" });
  });

  it("la musique ne compte pas", () => {
    const libraries = [library("Films", "movies", { EnableTrickplayImageExtraction: true }), library("Musique", "music")];
    expect(check(evaluateSetup(snapshot({ libraries })), "trickplay").libraries?.map((l) => l.name)).toEqual(["Films"]);
  });

  it("TMDB : fait avec le greffon intégré actif, et le compte des titres sans identifiant", () => {
    expect(check(evaluateSetup(snapshot()), "metadataTmdb")).toMatchObject({ state: "done", level: "essential", missingTmdb: 1 });
  });

  it("TMDB écarté des fournisseurs d'une bibliothèque : à faire", () => {
    const libraries = [
      library("Films", "movies", { TypeOptions: [{ Type: "Movie", MetadataFetchers: ["The Open Movie Database"] }] }),
      library("Séries", "tvshows", { TypeOptions: [{ Type: "Series", MetadataFetchers: ["TheMovieDb"] }] }),
    ];
    const tmdb = check(evaluateSetup(snapshot({ libraries })), "metadataTmdb");
    expect(tmdb.state).toBe("todo");
    expect(tmdb.libraries?.map((l) => [l.name, l.enabled])).toEqual([["Films", false], ["Séries", true]]);
  });

  it("greffon TMDb désactivé : à faire, et c'est la page des greffons qui s'ouvre", () => {
    const plugins = PLUGINS_12_1.map((p) => (p.Name === "TMDb" ? { ...p, Status: "Disabled" } : p));
    expect(check(evaluateSetup(snapshot({ plugins })), "metadataTmdb")).toMatchObject({ state: "todo", dashboardPath: "/web/#/dashboard/plugins" });
  });

  it("langue des métadonnées : faite avec langue ET pays, sinon un geste la pose", () => {
    expect(check(evaluateSetup(snapshot()), "metadataLanguage")).toMatchObject({ state: "done", current: "fr · FR", action: null });
    const config = { PreferredMetadataLanguage: "", MetadataCountryCode: "" };
    expect(check(evaluateSetup(snapshot({ config })), "metadataLanguage")).toMatchObject({ state: "todo", current: null, action: "setMetadataLanguage" });
  });

  it("passages : aucun greffon → à faire ; les trois attendus, sans Chapter Segments", () => {
    const segments = check(evaluateSetup(snapshot()), "segmentsProvider");
    expect(segments).toMatchObject({ state: "todo", action: null });
    expect(segments.plugins?.map((p) => [p.name, p.state])).toEqual([["Intro Skipper", "missing"], ["TheIntroDB", "missing"], ["SkipMe.db", "missing"]]);
    expect(segments.task).toMatchObject({ state: "running", progress: 42, lastRunAt: "2026-09-29T11:06:51Z" });
  });

  it("passages : un seul des trois ne suffit plus", () => {
    const plugins = [...PLUGINS_12_1, { Name: "Intro Skipper", Status: "Active", Id: "c83d86bb-a1e0-4c35-a113-e2101cf4ee6b" }];
    expect(check(evaluateSetup(snapshot({ plugins })), "segmentsProvider")).toMatchObject({ state: "todo" });
  });

  it("passages : posés, en attente de redémarrage (« Restart »)", () => {
    const plugins = [
      ...PLUGINS_12_1,
      { Name: "Intro Skipper", Status: "Active", Id: "c83d86bba1e04c35a113e2101cf4ee6b" },
      { Name: "TheIntroDB", Status: "Restart", Id: "c9e41b9563e445e29db6b83df21ae5e7" },
      { Name: "SkipMe.db", Status: "Restart", Id: "b2a63e620ac545759ad22c7534ccb83d" },
    ];
    expect(check(evaluateSetup(snapshot({ plugins })), "segmentsProvider")).toMatchObject({ state: "pending-restart", action: null });
  });

  it("passages : les trois actifs ; le scan se relance d'un clic quand il est au repos", () => {
    const plugins = [
      ...PLUGINS_12_1,
      { Name: "Intro Skipper", Status: "Active", Id: "c83d86bba1e04c35a113e2101cf4ee6b" },
      { Name: "TheIntroDB", Status: "Active", Id: "c9e41b9563e445e29db6b83df21ae5e7" },
      { Name: "SkipMe.db", Status: "Active", Id: "b2a63e620ac545759ad22c7534ccb83d" },
    ];
    const tasks = [{ Key: "TaskExtractMediaSegments", Id: "t-seg", State: "Idle", LastExecutionResult: null }];
    const segments = check(evaluateSetup(snapshot({ plugins, tasks })), "segmentsProvider");
    expect(segments).toMatchObject({ state: "done", action: "scanMediaSegments" });
    expect(segments.plugins?.find((p) => p.name === "SkipMe.db")).toMatchObject({ state: "active", repositoryUrl: "https://intro-skipper.org/manifest.json" });
  });

  it("accélération matérielle : « none » est à faire, mais seulement conseillé ; sans lien vers autre chose que le transcodage", () => {
    expect(check(evaluateSetup(snapshot()), "hardwareAcceleration")).toMatchObject({ state: "todo", level: "optional", action: null, dashboardPath: "/web/#/dashboard/playback/transcoding" });
    expect(check(evaluateSetup(snapshot({ encoding: { HardwareAccelerationType: "vaapi" } })), "hardwareAcceleration")).toMatchObject({ state: "done", current: "vaapi" });
  });

  it("encodage HEVC : conseillé seulement avec un encodeur matériel ; un Jellyfin muet sur ce champ reste inconnu", () => {
    const hevc = (encoding: Record<string, unknown> | null) => check(evaluateSetup(snapshot({ encoding })), "hevcEncoding");
    expect(hevc({ HardwareAccelerationType: "vaapi", AllowHevcEncoding: false })).toMatchObject({
      state: "todo", level: "recommended", current: "off", action: "enableHevcEncoding", dashboardPath: "/web/#/dashboard/playback/transcoding",
    });
    expect(hevc({ HardwareAccelerationType: "none", AllowHevcEncoding: false })).toMatchObject({ state: "not-needed", action: null });
    expect(hevc({ HardwareAccelerationType: "", AllowHevcEncoding: true })).toMatchObject({ state: "done", current: "on", action: null });
    expect(hevc({ HardwareAccelerationType: "qsv" })).toMatchObject({ state: "unknown", current: null, action: null });
  });

  it("images de chapitres : jamais « à faire » — Tentacle ne les affiche pas", () => {
    const libraries = [library("Films", "movies", { EnableChapterImageExtraction: true })];
    const chapters = check(evaluateSetup(snapshot({ libraries })), "chapterImages");
    expect(chapters).toMatchObject({ state: "not-needed", action: null });
    expect(chapters.libraries?.[0].enabled).toBe(true);
  });

  it("ce que Jellyfin n'a pas rendu est inconnu, sans rien inventer", () => {
    const checks = evaluateSetup(snapshot({ libraries: null, plugins: null, config: null, encoding: null, tasks: null, missingTmdb: null, trailers: null }));
    expect(checks.filter((c) => c.id !== "chapterImages").map((c) => c.state)).toEqual(Array(9).fill("unknown"));
    expect(checks.every((c) => c.action === null)).toBe(true);
  });
});
