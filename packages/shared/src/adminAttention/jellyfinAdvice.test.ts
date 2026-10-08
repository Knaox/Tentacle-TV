import { describe, expect, it } from "vitest";
import type { SetupCheck, SetupCheckId, SetupLevel, SetupPlugin, SetupState } from "../jellyfinCompat/setupContract";
import { buildAdminAttention, type AttentionSources } from "./attentionModel";
import { isJellyfinTodo, jellyfinAdvice } from "./jellyfinAdvice";

function check(id: SetupCheckId, state: SetupState, extra: Partial<SetupCheck> = {}, level: SetupLevel = "recommended"): SetupCheck {
  return {
    id, level, state, libraries: null, current: null, missingTmdb: null, plugins: null, task: null, trailers: null, action: null, dashboardPath: "/web/",
    ...extra,
  };
}

const plugin = (name: string, state: SetupPlugin["state"]): SetupPlugin => ({ name, state, official: false, homepage: null, repositoryUrl: null });
const fr = { language: "fr", country: "FR" };

/** Un Jellyfin rejoint tel qu'on le trouve souvent : rien de ce que Tentacle conseille n'est fait. */
const fresh: SetupCheck[] = [
  check("metadataTmdb", "todo", {}, "essential"),
  check("metadataLanguage", "todo", { action: "setMetadataLanguage" }),
  check("trailers", "todo"),
  check("trickplay", "todo", {
    action: "enableTrickplay",
    libraries: [{ id: "a", name: "Films", enabled: true }, { id: "b", name: "Séries", enabled: false }],
  }),
  check("segmentsProvider", "todo", { plugins: [plugin("Intro Skipper", "active"), plugin("TheIntroDB", "missing"), plugin("SkipMe.db", "disabled")] }),
  check("realtimeMonitor", "todo", { action: "enableRealtimeMonitor", libraries: [{ id: "a", name: "Films", enabled: false }] }),
  check("libraryUpdateDelay", "todo", { action: "shortenLibraryUpdateDelay", current: "30 s" }),
  check("hardwareAcceleration", "todo", {}, "optional"),
  check("hevcEncoding", "todo", { action: "enableHevcEncoding", current: "off" }),
  check("chapterImages", "not-needed", {}, "optional"),
];

describe("les réglages conseillés d'un Jellyfin déjà configuré", () => {
  it("seulement ce qui se règle d'un geste sûr, dans l'ordre de l'écran, coché d'office", () => {
    const advice = jellyfinAdvice(fresh, fr);
    expect(advice.map((a) => [a.id, a.gesture, a.preselected])).toEqual([
      ["segmentsProvider", "segmentPlugins", true],
      ["metadataLanguage", "setMetadataLanguage", true],
      ["trickplay", "enableTrickplay", true],
      ["realtimeMonitor", "enableRealtimeMonitor", true],
      ["libraryUpdateDelay", "shortenLibraryUpdateDelay", true],
      ["hevcEncoding", "enableHevcEncoding", true],
    ]);
    // Rien sans geste (TMDB, bandes-annonces), rien de facultatif (accélération matérielle).
    expect(advice.some((a) => a.id === "metadataTmdb" || a.id === "trailers" || a.id === "hardwareAcceleration")).toBe(false);
  });

  it("chaque conseil dit la valeur en place et la valeur conseillée, et ce qu'il touche", () => {
    const byId = Object.fromEntries(jellyfinAdvice(fresh, fr).map((a) => [a.id, a]));
    expect(byId.metadataLanguage).toMatchObject({ current: null, recommended: "fr · FR", targets: [] });
    expect(byId.trickplay).toMatchObject({ current: "off", recommended: "on", targets: ["Séries"] });
    expect(byId.hevcEncoding).toMatchObject({ current: "off", recommended: "on" });
    // L'annonce des ajouts se dit en secondes, pas en marche / arrêt.
    expect(byId.libraryUpdateDelay).toMatchObject({ current: "30 s", recommended: "5 s" });
    expect(byId.segmentsProvider).toMatchObject({ current: null, recommended: null, targets: ["TheIntroDB", "SkipMe.db"] });
  });

  it("une langue réglée AUTREMENT est montrée, jamais cochée ; la même, rien à dire", () => {
    const english = [check("metadataLanguage", "done", { current: "en · US" })];
    expect(jellyfinAdvice(english, fr)).toEqual([
      { id: "metadataLanguage", gesture: "setMetadataLanguage", current: "en · US", recommended: "fr · FR", preselected: false, targets: [] },
    ]);
    expect(jellyfinAdvice([check("metadataLanguage", "done", { current: "fr · FR" })], fr)).toEqual([]);
  });

  it("rien de fait, en attente de redémarrage, inutile ou inconnu : rien à proposer", () => {
    const settled = [
      check("trickplay", "done", { action: "generateTrickplay" }),
      check("segmentsProvider", "pending-restart"),
      check("hevcEncoding", "not-needed"),
      check("realtimeMonitor", "unknown"),
    ];
    expect(jellyfinAdvice(settled, fr)).toEqual([]);
  });

  it("une règle avec le tableau de bord : ce que l'assistant coche, l'entrée « Jellyfin » le compte", () => {
    const sources: AttentionSources = {
      jellyfin: { state: "connected" }, adminKey: "ok", databaseDown: false, tmdbConfigured: true, links: [],
      jellyfinSetup: { restartPending: false, checks: fresh }, jellyfinVersion: "compatible", serverUpdate: "up-to-date",
      refusedExtensions: [],
      dismissed: { publicUrl: false, tmdbKey: false, jellyfin: false, segmentPlugins: false, directPlay: false },
      capabilities: new Set(["admin.segmentPlugins"] as const),
    };
    const attention = buildAdminAttention(sources);
    const items = attention.recommendations.find((entry) => entry.id === "jellyfin")?.items ?? [];
    for (const advice of jellyfinAdvice(fresh, fr).filter((a) => a.gesture !== "segmentPlugins")) {
      expect(items).toContain(`setup:${advice.id}`);
    }
    expect(attention.recommendations.some((entry) => entry.id === "segmentPlugins")).toBe(true);
    expect(fresh.filter(isJellyfinTodo).map((c) => c.id)).toEqual(["metadataTmdb", "metadataLanguage", "trailers", "trickplay", "realtimeMonitor", "libraryUpdateDelay", "hevcEncoding"]);
  });
});
