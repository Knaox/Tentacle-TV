import { describe, expect, it } from "vitest";
import { findSegments } from "./segmentTypes";
import { resolvePlaybackSegments, type SegmentSources } from "./resolveSegments";
import type { BoundsByType } from "./segmentChapters";
import { applyTailVerdict, tailOutros, type TailVerdict } from "./tailVerdict";

const min = (m: number, s = 0): number => (m * 60 + s) * 1000;
const ticks = (ms: number): number => ms * 10_000;
const outro = (startMs: number, endMs: number) => ({ Type: "Outro", StartTicks: ticks(startMs), EndTicks: ticks(endMs) });

const verdict = (over: Partial<TailVerdict>): TailVerdict => ({
  creditsStartMs: min(100),
  scenes: [],
  crawl: null,
  audio: true,
  ...over,
});

const outros = (runtimeMs: number, sources: SegmentSources) =>
  findSegments(resolvePlaybackSegments("item", runtimeMs, sources, "").segments, "Outro");

describe("tailOutros — les génériques dessinés autour des scènes", () => {
  it("Avengers : deux scènes, deux génériques qui y mènent, et rien d'autre", () => {
    const runtime = min(142, 56);
    const drawn = tailOutros(
      verdict({ creditsStartMs: min(133, 8), scenes: [{ startMs: min(135, 8), endMs: min(135, 55) }, { startMs: min(142, 12), endMs: min(142, 50) }] }),
      runtime,
    );
    expect(drawn).toEqual([
      { startMs: min(133, 8), endMs: min(135, 7), source: "audio" },
      { startMs: min(135, 55), endMs: min(142, 11), source: "audio" },
    ]);
  });

  it("le générique final, après la dernière scène, ne vaut que s'il dure", () => {
    const drawn = tailOutros(verdict({ creditsStartMs: min(100), scenes: [{ startMs: min(102), endMs: min(103) }] }), min(110));
    expect(drawn.map((o) => [o.startMs, o.endMs])).toEqual([[min(100), min(102) - 1000], [min(103), min(110)]]);
  });

  it("une scène collée au début du générique n'en ouvre pas un de quelques secondes", () => {
    const drawn = tailOutros(verdict({ creditsStartMs: min(100), scenes: [{ startMs: min(100, 10), endMs: min(101) }] }), min(108));
    expect(drawn).toEqual([{ startMs: min(101), endMs: min(108), source: "audio" }]);
  });

  it("sans audio, la source dit « frames »", () => {
    expect(tailOutros(verdict({ audio: false }), min(110))[0].source).toBe("frames");
  });
});

describe("applyTailVerdict — quand le verdict a le dernier mot", () => {
  it("Ultron : le générique de Jellyfin avalait la scène de Thanos — il est redessiné", () => {
    const runtime = min(141, 18);
    const found = outros(runtime, {
      mediaSegments: { Items: [outro(min(131, 8), runtime)] },
      tail: verdict({ creditsStartMs: min(131, 8), scenes: [{ startMs: min(133, 5), endMs: min(133, 28) }] }),
    });
    expect(found.map((o) => [o.startMs, o.endMs, o.hasContentAfter])).toEqual([
      [min(131, 8), min(133, 4), true],
      [min(133, 28), runtime, false],
    ]);
  });

  it("Deadpool : le marqueur posé dans le baiser final disparaît", () => {
    const runtime = min(108, 6);
    const found = outros(runtime, {
      mediaSegments: { Items: [outro(min(99, 53), min(100, 58)), outro(min(100, 58), min(106, 58))] },
      tail: verdict({ creditsStartMs: min(100, 58), scenes: [{ startMs: min(106, 58), endMs: min(107, 55) }] }),
    });
    expect(found.map((o) => [o.startMs, o.endMs])).toEqual([[min(100, 58), min(106, 57)]]);
  });

  it("sans générique de fournisseur, le verdict en pose un, même sans scène", () => {
    const found = outros(min(110), { tail: verdict({ creditsStartMs: min(101) }) });
    expect(found.map((o) => [o.startMs, o.endMs, o.hasContentAfter])).toEqual([[min(101), min(110), false]]);
  });

  it("sans scène trouvée, un générique de fournisseur qui court jusqu'au bout reste le sien", () => {
    const found = outros(min(110), {
      mediaSegments: { Items: [outro(min(100, 30), min(110))] },
      tail: verdict({ creditsStartMs: min(101), crawl: [min(102), min(109)] }),
    });
    expect(found[0]).toMatchObject({ startMs: min(100, 30), source: "jellyfin" });
  });

  it("une scène promise par un fournisseur, démentie par le défilement qui continue, est retirée", () => {
    const found = outros(min(110), {
      mediaSegments: { Items: [outro(min(100), min(104))] },
      tail: verdict({ creditsStartMs: min(100), crawl: [min(100, 30), min(109, 30)] }),
    });
    expect(found.map((o) => [o.startMs, o.endMs, o.hasContentAfter])).toEqual([[min(100), min(110), false]]);
  });

  it("une scène promise par un fournisseur, sans défilement pour la démentir, est gardée", () => {
    // Jujutsu Kaisen : l'ending finit avant « Juju Sanpo » ; l'analyse n'a rien trouvé, elle se tait.
    const found = outros(min(23, 55), {
      mediaSegments: { Items: [outro(min(21, 16), min(22, 43))] },
      tail: verdict({ creditsStartMs: min(21, 16), crawl: null }),
    });
    expect(found[0]).toMatchObject({ endMs: min(22, 43), hasContentAfter: true, source: "jellyfin" });
  });

  it("One Piece : le marqueur qui s'arrête juste avant l'aperçu promettait l'aperçu — le générique court jusqu'au bout", () => {
    const runtime = min(23, 35);
    const found = outros(runtime, {
      mediaSegments: { Items: [outro(min(22, 48), min(23, 5))] },
      tail: verdict({ creditsStartMs: min(22, 48), preview: [min(23, 5), runtime] }),
    });
    expect(found.map((o) => [o.startMs, o.endMs, o.hasContentAfter])).toEqual([[min(22, 48), runtime, false]]);
  });

  it("une vraie scène avant l'aperçu reste promise : le marqueur qui s'y arrête est gardé", () => {
    // « Fullmetal Alchemist » S1E30 : la partie C, puis l'aperçu ; seul l'aperçu dément.
    const found = outros(min(24, 28), {
      mediaSegments: { Items: [outro(min(22, 7), min(23, 37))] },
      tail: verdict({ creditsStartMs: min(22, 7), preview: [min(23, 58), min(24, 28)] }),
    });
    expect(found[0]).toMatchObject({ endMs: min(23, 37), hasContentAfter: true, source: "jellyfin" });
  });

  it("un verdict absent ne touche à rien", () => {
    const bounds: BoundsByType = new Map([["Outro", [{ startMs: 1, endMs: 2, source: "jellyfin" }]]]);
    applyTailVerdict(bounds, null, min(10));
    expect(bounds.get("Outro")).toEqual([{ startMs: 1, endMs: 2, source: "jellyfin" }]);
  });

  it("l'intro et les autres passages ne sont jamais touchés", () => {
    const bounds: BoundsByType = new Map([["Intro", [{ startMs: 0, endMs: 90_000, source: "jellyfin" }]]]);
    applyTailVerdict(bounds, verdict({ creditsStartMs: min(100), scenes: [{ startMs: min(102), endMs: min(103) }] }), min(110));
    expect(bounds.get("Intro")).toEqual([{ startMs: 0, endMs: 90_000, source: "jellyfin" }]);
  });
});
