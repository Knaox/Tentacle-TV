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
  it("rend les sept réglages, dans l'ordre de la page", () => {
    expect(evaluateSetup(snapshot()).map((c) => c.id)).toEqual([
      "metadataTmdb", "metadataLanguage", "trickplay", "segmentsProvider", "realtimeMonitor", "hardwareAcceleration", "chapterImages",
    ]);
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

  it("passages : aucun greffon → à faire, le greffon officiel s'installe d'un clic", () => {
    const segments = check(evaluateSetup(snapshot()), "segmentsProvider");
    expect(segments).toMatchObject({ state: "todo", action: "installChapterSegments" });
    expect(segments.plugins?.find((p) => p.official)).toMatchObject({ name: "Chapter Segments Provider", state: "missing" });
    expect(segments.task).toMatchObject({ state: "running", progress: 42, lastRunAt: "2026-09-29T11:06:51Z" });
  });

  it("passages : greffon installé en attente de redémarrage (10.11.8, « Restart »)", () => {
    const plugins = [...PLUGINS_12_1, { Name: "Chapter Segments Provider", Status: "Restart", Id: "c" }];
    expect(check(evaluateSetup(snapshot({ plugins })), "segmentsProvider")).toMatchObject({ state: "pending-restart", action: null });
  });

  it("passages : un fournisseur tiers actif suffit ; le scan se relance d'un clic quand il est au repos", () => {
    const plugins = [...PLUGINS_12_1, { Name: "Intro Skipper", Status: "Active", Id: "i" }];
    const tasks = [{ Key: "TaskExtractMediaSegments", Id: "t-seg", State: "Idle", LastExecutionResult: null }];
    const segments = check(evaluateSetup(snapshot({ plugins, tasks })), "segmentsProvider");
    expect(segments).toMatchObject({ state: "done", action: "scanMediaSegments" });
    expect(segments.plugins?.find((p) => p.name === "Intro Skipper")).toMatchObject({ state: "active", repositoryUrl: "https://intro-skipper.org/manifest.json" });
  });

  it("accélération matérielle : « none » est à faire, mais seulement conseillé ; sans lien vers autre chose que le transcodage", () => {
    expect(check(evaluateSetup(snapshot()), "hardwareAcceleration")).toMatchObject({ state: "todo", level: "optional", action: null, dashboardPath: "/web/#/dashboard/playback/transcoding" });
    expect(check(evaluateSetup(snapshot({ encoding: { HardwareAccelerationType: "vaapi" } })), "hardwareAcceleration")).toMatchObject({ state: "done", current: "vaapi" });
  });

  it("images de chapitres : jamais « à faire » — Tentacle ne les affiche pas", () => {
    const libraries = [library("Films", "movies", { EnableChapterImageExtraction: true })];
    const chapters = check(evaluateSetup(snapshot({ libraries })), "chapterImages");
    expect(chapters).toMatchObject({ state: "not-needed", action: null });
    expect(chapters.libraries?.[0].enabled).toBe(true);
  });

  it("ce que Jellyfin n'a pas rendu est inconnu, sans rien inventer", () => {
    const checks = evaluateSetup(snapshot({ libraries: null, plugins: null, config: null, encoding: null, tasks: null, missingTmdb: null }));
    expect(checks.filter((c) => c.id !== "chapterImages").map((c) => c.state)).toEqual(Array(6).fill("unknown"));
    expect(checks.every((c) => c.action === null)).toBe(true);
  });
});
