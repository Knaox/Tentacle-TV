import { describe, expect, it } from "vitest";
import { POST_CREDITS_THRESHOLD_MS, findSegment } from "./segmentTypes";
import { resolvePlaybackSegments, type SegmentSources } from "./resolveSegments";

/** ms → ticks Jellyfin (1 tick = 100 ns). */
const ticks = (ms: number) => ms * 10_000;

const RUNTIME_MS = 1_440_000; // 24 min

const resoudre = (sources: SegmentSources, runtimeMs = RUNTIME_MS) =>
  resolvePlaybackSegments("item-1", runtimeMs, sources, "2026-08-28T00:00:00.000Z");

describe("resolvePlaybackSegments — source native", () => {
  it("lit les cinq types en ms, source jellyfin", () => {
    const { segments } = resoudre({
      mediaSegments: {
        Items: [
          { Type: "Recap", StartTicks: ticks(0), EndTicks: ticks(30_000) },
          { Type: "Intro", StartTicks: ticks(30_000), EndTicks: ticks(120_000) },
          { Type: "Commercial", StartTicks: ticks(600_000), EndTicks: ticks(630_000) },
          { Type: "Preview", StartTicks: ticks(1_400_000), EndTicks: ticks(1_420_000) },
          { Type: "Outro", StartTicks: ticks(1_300_000), EndTicks: ticks(1_380_000) },
        ],
      },
    });
    expect(segments.map((s) => s.type)).toEqual([
      "Recap", "Intro", "Commercial", "Outro", "Preview",
    ]); // triés par startMs
    expect(findSegment(segments, "Intro")).toMatchObject({
      startMs: 30_000, endMs: 120_000, source: "jellyfin",
    });
  });

  it("des Items présents font foi : les greffons ne sont pas consultés", () => {
    const { segments } = resoudre({
      mediaSegments: { Items: [{ Type: "Intro", StartTicks: 0, EndTicks: ticks(90_000) }] },
      pluginDict: { Credits: { start: 1_300, end: 1_400 } },
    });
    expect(findSegment(segments, "Outro")).toBeNull();
    expect(findSegment(segments, "Intro")).not.toBeNull();
  });

  it("ignore un type inconnu sans casser le reste", () => {
    const { segments } = resoudre({
      mediaSegments: {
        Items: [
          { Type: "Unknown", StartTicks: 0, EndTicks: ticks(5_000) },
          { Type: "Intro", StartTicks: 0, EndTicks: ticks(90_000) },
        ],
      },
    });
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe("Intro");
  });
});

describe("resolvePlaybackSegments — greffon intro-skipper", () => {
  it("dictionnaire : PascalCase et camelCase, secondes converties en ms", () => {
    const { segments } = resoudre({
      pluginDict: {
        Introduction: { Start: 10, End: 95 },
        credits: { start: 1_320, end: 1_425 },
        recap: { start: 0, end: 10 },
      },
    });
    expect(findSegment(segments, "Intro")).toMatchObject({ startMs: 10_000, endMs: 95_000 });
    expect(findSegment(segments, "Outro")).toMatchObject({ startMs: 1_320_000, endMs: 1_425_000 });
    expect(findSegment(segments, "Recap")).toMatchObject({ startMs: 0, endMs: 10_000 });
  });

  it("le dictionnaire prime sur les propriétés nommées", () => {
    const { segments } = resoudre({
      pluginDict: { Introduction: { start: 5, end: 60 } },
      pluginTimestamps: { introduction: { start: 99, end: 199 } },
    });
    expect(findSegment(segments, "Intro")).toMatchObject({ startMs: 5_000, endMs: 60_000 });
  });

  it("propriétés nommées : récap et aperçu sont enfin lus", () => {
    const { segments } = resoudre({
      pluginTimestamps: {
        introduction: { start: 30, end: 120 },
        recap: { start: 0, end: 28 },
        preview: { start: 1_400, end: 1_430 },
      },
    });
    expect(findSegment(segments, "Recap")).not.toBeNull();
    expect(findSegment(segments, "Preview")).not.toBeNull();
  });

  it("un dictionnaire sans borne exploitable laisse la main aux propriétés nommées", () => {
    const { segments } = resoudre({
      pluginDict: { Introduction: { start: 10, end: 0 } },
      pluginTimestamps: { credits: { start: 1_350, end: 1_440 } },
    });
    expect(findSegment(segments, "Outro")).not.toBeNull();
  });
});

describe("resolvePlaybackSegments — repli chapitres", () => {
  const chapitres = (noms: string[], pasMs = 300_000) =>
    noms.map((Name, i) => ({ Name, StartPositionTicks: ticks(i * pasMs) }));

  it("comble un Outro manquant depuis un chapitre nommé, marqué chapters", () => {
    const { segments } = resoudre({
      chapters: chapitres(["Chapitre 1", "Chapitre 2", "Chapitre 3", "Générique de fin"], 400_000),
    });
    expect(findSegment(segments, "Outro")).toMatchObject({
      startMs: 1_200_000, endMs: RUNTIME_MS, source: "chapters",
    });
  });

  it("comble PAR TYPE : Outro natif conservé, Intro pris aux chapitres", () => {
    const { segments } = resoudre({
      mediaSegments: {
        Items: [{ Type: "Outro", StartTicks: ticks(1_300_000), EndTicks: ticks(RUNTIME_MS) }],
      },
      chapters: chapitres(["Opening", "Épisode", "Fin"]),
    });
    expect(findSegment(segments, "Intro")).toMatchObject({
      startMs: 0, endMs: 300_000, source: "chapters",
    });
    expect(findSegment(segments, "Outro")).toMatchObject({ source: "jellyfin" });
  });

  it("« Générique de début » est une intro, jamais un générique de fin", () => {
    const { segments } = resoudre({
      chapters: chapitres(["Générique de début", "Épisode", "Générique"], 500_000),
    });
    expect(findSegment(segments, "Intro")).toMatchObject({ startMs: 0, endMs: 500_000 });
    expect(findSegment(segments, "Outro")).toMatchObject({ startMs: 1_000_000, endMs: RUNTIME_MS });
  });

  it("« Opening Credits » est une intro malgré le mot credits", () => {
    const { segments } = resoudre({
      chapters: chapitres(["Opening Credits", "Scène 1", "End Credits"], 500_000),
    });
    expect(findSegment(segments, "Intro")).toMatchObject({ startMs: 0 });
    expect(findSegment(segments, "Outro")).toMatchObject({ startMs: 1_000_000 });
  });

  it("le dernier chapitre correspondant l'emporte pour le générique de fin", () => {
    const { segments } = resoudre({
      chapters: chapitres(["Credits", "Scène", "Credits"], 500_000),
    });
    expect(findSegment(segments, "Outro")).toMatchObject({ startMs: 1_000_000 });
  });

  it("la fin d'un générique en dernier chapitre est la durée du média — plus de +120 deviné", () => {
    const { segments } = resoudre({
      chapters: chapitres(["Scène", "Outro"], 100_000),
    });
    expect(findSegment(segments, "Outro")?.endMs).toBe(RUNTIME_MS);
  });

  it("une intro en dernier chapitre (sans suivant) n'est pas posée", () => {
    const { segments } = resoudre({ chapters: chapitres(["Scène", "Intro"]) });
    expect(findSegment(segments, "Intro")).toBeNull();
  });

  it("sans segment ni chapitre nommé : rien — aucun repli statistique", () => {
    const { segments } = resoudre({ chapters: chapitres(["Un", "Deux", "Trois"]) });
    expect(segments).toEqual([]);
  });
});

describe("resolvePlaybackSegments — fin de média et assainissement", () => {
  const outroNatif = (endMs: number): SegmentSources => ({
    mediaSegments: {
      Items: [{ Type: "Outro", StartTicks: ticks(1_300_000), EndTicks: ticks(endMs) }],
    },
  });

  it("endsAtMediaEnd au seuil exact : à 15 s du bout, le générique touche la fin", () => {
    const pile = resoudre(outroNatif(RUNTIME_MS - POST_CREDITS_THRESHOLD_MS));
    expect(pile.segments[0]).toMatchObject({ endsAtMediaEnd: true, hasContentAfter: false });

    const avant = resoudre(outroNatif(RUNTIME_MS - POST_CREDITS_THRESHOLD_MS - 1));
    expect(avant.segments[0]).toMatchObject({ endsAtMediaEnd: false, hasContentAfter: true });
  });

  it("durée inconnue : verdict conservateur — jamais de scène post-générique promise", () => {
    const reponse = resolvePlaybackSegments("item-1", 0, {
      mediaSegments: {
        Items: [
          { Type: "Outro", StartTicks: ticks(1_300_000), EndTicks: ticks(1_400_000) },
          { Type: "Intro", StartTicks: 0, EndTicks: ticks(90_000) },
        ],
      },
    });
    expect(findSegment(reponse.segments, "Outro")).toMatchObject({
      endsAtMediaEnd: false, hasContentAfter: false,
    });
    expect(findSegment(reponse.segments, "Intro")).toMatchObject({ hasContentAfter: true });
  });

  it("durée inconnue : aucun Outro issu des chapitres", () => {
    const reponse = resolvePlaybackSegments("item-1", 0, {
      chapters: [
        { Name: "Scène", StartPositionTicks: 0 },
        { Name: "Credits", StartPositionTicks: ticks(1_300_000) },
        { Name: "Après", StartPositionTicks: ticks(1_400_000) },
      ],
    });
    expect(reponse.segments).toEqual([]);
  });

  it("borne au média, rejette l'inversé, arrondit et trie", () => {
    const { segments } = resoudre({
      mediaSegments: {
        Items: [
          { Type: "Outro", StartTicks: ticks(1_400_000), EndTicks: ticks(2_000_000) },
          { Type: "Intro", StartTicks: ticks(90_000), EndTicks: ticks(30_000) },
          { Type: "Recap", StartTicks: ticks(500.4), EndTicks: ticks(10_000) },
        ],
      },
    });
    expect(findSegment(segments, "Intro")).toBeNull();
    expect(findSegment(segments, "Outro")?.endMs).toBe(RUNTIME_MS);
    expect(findSegment(segments, "Recap")?.startMs).toBe(500);
    expect(segments.map((s) => s.type)).toEqual(["Recap", "Outro"]);
  });

  it("l'enveloppe porte version, item, durée et horodatage injecté", () => {
    const reponse = resoudre({});
    expect(reponse).toMatchObject({
      version: 1,
      itemId: "item-1",
      runtimeMs: RUNTIME_MS,
      resolvedAt: "2026-08-28T00:00:00.000Z",
      segments: [],
    });
  });
});
