import { describe, expect, it } from "vitest";
import { resolveLocalSegmentsPayload } from "./localSegments";

const ticks = (ms: number) => ms * 10_000;

const ITEM = {
  RunTimeTicks: ticks(1_440_000),
  Chapters: [
    { Name: "Épisode", StartPositionTicks: 0 },
    { Name: "Générique de fin", StartPositionTicks: ticks(1_300_000) },
  ],
};

describe("resolveLocalSegmentsPayload — la migration de l'ancien segments.json", () => {
  it("un contrat v1 est relu tel quel, sans re-résolution", () => {
    const contract = {
      version: 1,
      itemId: "ep-1",
      runtimeMs: 1_440_000,
      resolvedAt: "",
      segments: [
        {
          type: "Recap",
          startMs: 0,
          endMs: 30_000,
          source: "jellyfin",
          endsAtMediaEnd: false,
          hasContentAfter: true,
        },
      ],
    };
    expect(resolveLocalSegmentsPayload(contract, "ep-1", ITEM)).toEqual(contract);
  });

  it("l'ancien format à trois clés brutes est résolu localement — même fonction que le serveur", () => {
    const old = {
      mediaSegments: {
        Items: [{ Type: "Intro", StartTicks: 0, EndTicks: ticks(90_000) }],
      },
      pluginDict: null,
      pluginTs: null,
    };
    const contract = resolveLocalSegmentsPayload(old, "ep-1", ITEM);
    // L'Intro vient du payload brut ; l'Outro manquant est COMBLÉ par le
    // chapitre nommé du DTO local — le comblement par type joue aussi ici.
    expect(contract.segments).toHaveLength(2);
    expect(contract.segments[0]).toMatchObject({ type: "Intro", endMs: 90_000, source: "jellyfin" });
    expect(contract.segments[1]).toMatchObject({ type: "Outro", source: "chapters" });
    expect(contract.runtimeMs).toBe(1_440_000);
  });

  it("ancien format muet : le repli chapitres du DTO local joue", () => {
    const contract = resolveLocalSegmentsPayload(
      { mediaSegments: null, pluginDict: null, pluginTs: null },
      "ep-1",
      ITEM,
    );
    expect(contract.segments[0]).toMatchObject({
      type: "Outro",
      source: "chapters",
      startMs: 1_300_000,
      endMs: 1_440_000,
    });
  });

  it("fichier absent : chapitres seuls, et jamais d'exception", () => {
    const contract = resolveLocalSegmentsPayload(null, "ep-1", ITEM);
    expect(contract.segments[0]?.type).toBe("Outro");
    expect(resolveLocalSegmentsPayload(undefined, "ep-1", undefined).segments).toEqual([]);
  });
});
