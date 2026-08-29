import { describe, expect, it } from "vitest";
import { POST_CREDITS_MIN_MS, POST_CREDITS_THRESHOLD_MS, findSegment } from "./segmentTypes";
import { resolvePlaybackSegments, type SegmentSources } from "./resolveSegments";

/** ms → ticks Jellyfin (1 tick = 100 ns). */
const ticks = (ms: number) => ms * 10_000;

const RUNTIME_MS = 1_440_000; // 24 min

const resolve = (sources: SegmentSources, runtimeMs = RUNTIME_MS) =>
  resolvePlaybackSegments("item-1", runtimeMs, sources, "2026-08-28T00:00:00.000Z");

describe("resolvePlaybackSegments — source native", () => {
  it("lit les cinq types en ms, source jellyfin", () => {
    const { segments } = resolve({
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
    const { segments } = resolve({
      mediaSegments: { Items: [{ Type: "Intro", StartTicks: 0, EndTicks: ticks(90_000) }] },
      pluginDict: { Credits: { start: 1_300, end: 1_400 } },
    });
    expect(findSegment(segments, "Outro")).toBeNull();
    expect(findSegment(segments, "Intro")).not.toBeNull();
  });

  it("ignore un type inconnu sans casser le reste", () => {
    const { segments } = resolve({
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
    const { segments } = resolve({
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
    const { segments } = resolve({
      pluginDict: { Introduction: { start: 5, end: 60 } },
      pluginTimestamps: { introduction: { start: 99, end: 199 } },
    });
    expect(findSegment(segments, "Intro")).toMatchObject({ startMs: 5_000, endMs: 60_000 });
  });

  it("propriétés nommées : récap et aperçu sont enfin lus", () => {
    const { segments } = resolve({
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
    const { segments } = resolve({
      pluginDict: { Introduction: { start: 10, end: 0 } },
      pluginTimestamps: { credits: { start: 1_350, end: 1_440 } },
    });
    expect(findSegment(segments, "Outro")).not.toBeNull();
  });
});

describe("resolvePlaybackSegments — repli chapitres", () => {
  const chapters = (names: string[], stepMs = 300_000) =>
    names.map((Name, i) => ({ Name, StartPositionTicks: ticks(i * stepMs) }));

  it("comble un Outro manquant depuis un chapitre nommé, marqué chapters", () => {
    const { segments } = resolve({
      chapters: chapters(["Chapitre 1", "Chapitre 2", "Chapitre 3", "Générique de fin"], 400_000),
    });
    expect(findSegment(segments, "Outro")).toMatchObject({
      startMs: 1_200_000, endMs: RUNTIME_MS, source: "chapters",
    });
  });

  it("comble PAR TYPE : Outro natif conservé, Intro pris aux chapitres", () => {
    const { segments } = resolve({
      mediaSegments: {
        Items: [{ Type: "Outro", StartTicks: ticks(1_300_000), EndTicks: ticks(RUNTIME_MS) }],
      },
      chapters: chapters(["Opening", "Épisode", "Fin"]),
    });
    expect(findSegment(segments, "Intro")).toMatchObject({
      startMs: 0, endMs: 300_000, source: "chapters",
    });
    expect(findSegment(segments, "Outro")).toMatchObject({ source: "jellyfin" });
  });

  it("« Générique de début » est une intro, jamais un générique de fin", () => {
    const { segments } = resolve({
      chapters: chapters(["Générique de début", "Épisode", "Générique"], 500_000),
    });
    expect(findSegment(segments, "Intro")).toMatchObject({ startMs: 0, endMs: 500_000 });
    expect(findSegment(segments, "Outro")).toMatchObject({ startMs: 1_000_000, endMs: RUNTIME_MS });
  });

  it("« Opening Credits » est une intro malgré le mot credits", () => {
    const { segments } = resolve({
      chapters: chapters(["Opening Credits", "Scène 1", "End Credits"], 500_000),
    });
    expect(findSegment(segments, "Intro")).toMatchObject({ startMs: 0 });
    expect(findSegment(segments, "Outro")).toMatchObject({ startMs: 1_000_000 });
  });

  it("le dernier chapitre correspondant l'emporte pour le générique de fin", () => {
    const { segments } = resolve({
      chapters: chapters(["Credits", "Scène", "Credits"], 500_000),
    });
    expect(findSegment(segments, "Outro")).toMatchObject({ startMs: 1_000_000 });
  });

  it("la fin d'un générique en dernier chapitre est la durée du média — plus de +120 deviné", () => {
    const { segments } = resolve({
      chapters: chapters(["Scène", "Outro"], 100_000),
    });
    expect(findSegment(segments, "Outro")?.endMs).toBe(RUNTIME_MS);
  });

  it("une intro en dernier chapitre (sans suivant) n'est pas posée", () => {
    const { segments } = resolve({ chapters: chapters(["Scène", "Intro"]) });
    expect(findSegment(segments, "Intro")).toBeNull();
  });

  it("sans segment ni chapitre nommé : rien — aucun repli statistique", () => {
    const { segments } = resolve({ chapters: chapters(["Un", "Deux", "Trois"]) });
    expect(segments).toEqual([]);
  });
});

describe("resolvePlaybackSegments — fin de média et assainissement", () => {
  const nativeOutro = (endMs: number): SegmentSources => ({
    mediaSegments: {
      Items: [{ Type: "Outro", StartTicks: ticks(1_300_000), EndTicks: ticks(endMs) }],
    },
  });

  it("endsAtMediaEnd au seuil exact : à 15 s du bout, le générique touche la fin", () => {
    const exactly = resolve(nativeOutro(RUNTIME_MS - POST_CREDITS_THRESHOLD_MS));
    expect(exactly.segments[0]).toMatchObject({ endsAtMediaEnd: true, hasContentAfter: false });

    const before = resolve(nativeOutro(RUNTIME_MS - POST_CREDITS_THRESHOLD_MS - 1));
    expect(before.segments[0]).toMatchObject({ endsAtMediaEnd: false });
  });

  it("les deux seuils ne se répondent pas : quitter la fin ne fait pas une scène", () => {
    // 17 s du bout : le segment ne touche plus la fin, mais ce qui reste est
    // un fondu, pas une scène — on ne promet pas de scène post-générique.
    const grise = resolve(nativeOutro(RUNTIME_MS - 17_000));
    expect(grise.segments[0]).toMatchObject({ endsAtMediaEnd: false, hasContentAfter: false });

    const scene = resolve(nativeOutro(RUNTIME_MS - POST_CREDITS_MIN_MS));
    expect(scene.segments[0]).toMatchObject({ endsAtMediaEnd: false, hasContentAfter: true });
  });

  it("durée inconnue : verdict conservateur — jamais de scène post-générique promise", () => {
    const response = resolvePlaybackSegments("item-1", 0, {
      mediaSegments: {
        Items: [
          { Type: "Outro", StartTicks: ticks(1_300_000), EndTicks: ticks(1_400_000) },
          { Type: "Intro", StartTicks: 0, EndTicks: ticks(90_000) },
        ],
      },
    });
    expect(findSegment(response.segments, "Outro")).toMatchObject({
      endsAtMediaEnd: false, hasContentAfter: false,
    });
    expect(findSegment(response.segments, "Intro")).toMatchObject({ hasContentAfter: true });
  });

  it("durée inconnue : aucun Outro issu des chapitres", () => {
    const response = resolvePlaybackSegments("item-1", 0, {
      chapters: [
        { Name: "Scène", StartPositionTicks: 0 },
        { Name: "Credits", StartPositionTicks: ticks(1_300_000) },
        { Name: "Après", StartPositionTicks: ticks(1_400_000) },
      ],
    });
    expect(response.segments).toEqual([]);
  });

  it("borne au média, rejette l'inversé, arrondit et trie", () => {
    const { segments } = resolve({
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
    const response = resolve({});
    expect(response).toMatchObject({
      version: 1,
      itemId: "item-1",
      runtimeMs: RUNTIME_MS,
      resolvedAt: "2026-08-28T00:00:00.000Z",
      segments: [],
    });
  });
});

/**
 * Les cas réels, relevés le 29.08 sur l'instance de test (Jellyfin 10.11.8,
 * quatre greffons de segments). Ce sont eux qui commandent `pickBounds` et
 * l'affinage par chapitres — pas une intuition.
 */
describe("resolvePlaybackSegments — le corpus mesuré", () => {
  const minutes = (m: number, s = 0) => (m * 60 + s) * 1_000;
  const segment = (type: string, startMs: number, endMs: number) => ({
    Type: type,
    StartTicks: ticks(startMs),
    EndTicks: ticks(endMs),
  });
  const chapterAt = (ms: number, name: string) => ({
    StartPositionTicks: ticks(ms),
    Name: name,
  });

  it("Iron Man : un « générique » de 17 s collé à la fin n'est pas un générique", () => {
    const runtime = minutes(126);
    const { segments } = resolve(
      { mediaSegments: { Items: [segment("Outro", minutes(125, 43), runtime)] } },
      runtime,
    );
    // Aucun Outro : le film se termine tout seul, et la scène de Nick Fury est vue.
    expect(findSegment(segments, "Outro")).toBeNull();
  });

  it("Deadpool & Wolverine : le chapitre dans le générique EST la scène post-générique", () => {
    const runtime = minutes(127, 55);
    const { segments } = resolve(
      {
        mediaSegments: { Items: [segment("Outro", minutes(119, 49), runtime)] },
        chapters: [
          chapterAt(0, "Chapter 01"),
          chapterAt(minutes(7, 13), "Chapter 02"),
          chapterAt(minutes(28, 30), "Chapter 05"),
          chapterAt(minutes(53, 10), "Chapter 09"),
          chapterAt(minutes(90, 24), "Chapter 14"),
          chapterAt(minutes(119, 49), "Chapter 18"),
          chapterAt(minutes(126, 47), "Chapter 19"),
        ],
      },
      runtime,
    );
    const outro = findSegment(segments, "Outro");
    expect(outro).toMatchObject({ endMs: minutes(126, 47), hasContentAfter: true });
  });

  it("Endgame : un chapitre « End Credits » à l'heure pile, et rien après — pas de scène inventée", () => {
    const runtime = minutes(181, 12);
    const { segments } = resolve(
      {
        // Deux fournisseurs disent la même chose : l'union porte le doublon.
        mediaSegments: {
          Items: [
            segment("Outro", minutes(169, 6), runtime),
            segment("Outro", minutes(169, 6), runtime),
          ],
        },
        chapters: [
          chapterAt(0, "One Last Surprise"),
          chapterAt(minutes(48, 44), "Assembling The Avengers"),
          chapterAt(minutes(117, 27), "I Was Made For This"),
          chapterAt(minutes(154, 38), "Part Of The Journey Is The End"),
          chapterAt(minutes(169, 6), "End Credits"),
        ],
      },
      runtime,
    );
    const outro = findSegment(segments, "Outro");
    expect(outro).toMatchObject({ startMs: minutes(169, 6), endMs: runtime, hasContentAfter: false });
    expect(segments.filter((s) => s.type === "Outro")).toHaveLength(1);
  });

  it("des chapitres régulièrement espacés n'affinent RIEN — ils sont posés à la machine", () => {
    const runtime = minutes(120);
    const auto = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110].map((m) =>
      chapterAt(minutes(m), `Chapter ${m / 10 + 1}`),
    );
    const { segments } = resolve(
      {
        mediaSegments: { Items: [segment("Outro", minutes(105), runtime)] },
        chapters: auto,
      },
      runtime,
    );
    // Le chapitre à 110 min tombe en plein générique : le suivre enverrait le
    // spectateur au milieu du défilement.
    expect(findSegment(segments, "Outro")).toMatchObject({ endMs: runtime, hasContentAfter: false });
  });

  it("One Piece : un générique qui s'arrête avant la fin garde son aperçu", () => {
    const runtime = minutes(23, 36);
    const { segments } = resolve(
      { mediaSegments: { Items: [segment("Outro", minutes(21, 27), minutes(23, 7))] } },
      runtime,
    );
    expect(findSegment(segments, "Outro")).toMatchObject({ hasContentAfter: true });
  });

  it("les doublons d'un même passage se réduisent au plus large", () => {
    const runtime = minutes(23, 40);
    const { segments } = resolve(
      {
        mediaSegments: {
          Items: [
            segment("Intro", minutes(1, 41), minutes(3, 10)),
            segment("Intro", minutes(1, 41), minutes(3, 11)),
          ],
        },
      },
      runtime,
    );
    expect(segments.filter((s) => s.type === "Intro")).toHaveLength(1);
    expect(findSegment(segments, "Intro")).toMatchObject({ endMs: minutes(3, 11) });
  });
});
