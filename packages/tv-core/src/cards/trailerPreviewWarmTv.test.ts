import { describe, expect, it } from "vitest";
import type { TrailerPreviewSubject } from "@tentacle-tv/shared";
import { TV_PREVIEW_WARM_TIMING as T, createPreviewWarmQueue, trailerPreviewWarmWindow } from "./trailerPreviewWarmTv";

const item = (id: string): TrailerPreviewSubject => ({ kind: "item", itemId: id });
const tmdb = (id: number): TrailerPreviewSubject => ({ kind: "tmdb", tmdbId: id, mediaType: "movie" });
const never = () => false;

describe("trailerPreviewWarmWindow — les cartes autour du focus", () => {
  it("celle d'avant, la carte focalisée, et ce que la rangée montre après", () => {
    expect(trailerPreviewWarmWindow(3, 20)).toEqual([2, 9]);
  });

  it("bornée au début et à la fin de la rangée", () => {
    expect(trailerPreviewWarmWindow(0, 20)).toEqual([0, 6]);
    expect(trailerPreviewWarmWindow(18, 20)).toEqual([17, 20]);
    expect(trailerPreviewWarmWindow(0, 0)).toEqual([0, 0]);
  });
});

describe("createPreviewWarmQueue — la file de préparation des aperçus", () => {
  it("attend que le focus se pose : une rangée parcourue en tenant la flèche n'envoie rien", () => {
    const queue = createPreviewWarmQueue();
    for (let at = 0; at < 1_000; at += 100) queue.want([item(`a${at}`)], at);
    expect(queue.take(1_000, never)).toEqual([]);
    expect(queue.dueAt(1_000)).toBe(900 + T.settleMs);
    expect(queue.take(900 + T.settleMs, never)).toHaveLength(10);
  });

  it("les derniers demandés d'abord, jamais un titre déjà en cache", () => {
    const queue = createPreviewWarmQueue();
    queue.want([item("a"), item("b")], 0);
    queue.want([tmdb(603)], 10);
    const batch = queue.take(1_000, (subject) => subject.kind === "item" && subject.itemId === "a");
    expect(batch).toEqual([tmdb(603), item("b")]);
    expect(queue.dueAt(1_000)).toBeNull();
  });

  it("deux envois au plus par titre en dix minutes, le second après le délai de relance", () => {
    const queue = createPreviewWarmQueue();
    queue.want([item("a")], 0);
    expect(queue.take(T.settleMs, never)).toHaveLength(1);
    // Revu tout de suite : rien (trop tôt pour une relance).
    queue.want([item("a")], 1_000);
    expect(queue.take(1_000 + T.settleMs, never)).toEqual([]);
    // Après le délai : la relance.
    queue.want([item("a")], 6_000);
    expect(queue.take(6_000 + T.settleMs, never)).toHaveLength(1);
    // Une troisième fois : plus rien, jusqu'à la fin de la fenêtre.
    queue.want([item("a")], 20_000);
    expect(queue.take(20_000 + T.settleMs, never)).toEqual([]);
    // Dix minutes après le dernier envoi : de nouveau.
    const later = 6_000 + T.settleMs + T.windowMs;
    queue.want([item("a")], later);
    expect(queue.take(later + T.settleMs, never)).toHaveLength(1);
  });

  it("au plus 40 titres par envoi : le reste part au suivant", () => {
    const queue = createPreviewWarmQueue();
    queue.want(Array.from({ length: 45 }, (_, n) => item(`t${n}`)), 0);
    expect(queue.take(T.settleMs, never)).toHaveLength(40);
    expect(queue.take(T.settleMs, never)).toHaveLength(5);
  });

  it("un échec suspend tout le temps du recul", () => {
    const queue = createPreviewWarmQueue();
    queue.failed(0);
    queue.want([item("a")], 0);
    expect(queue.take(T.settleMs, never)).toEqual([]);
    expect(queue.dueAt(T.settleMs)).toBe(T.backoffMs);
    expect(queue.take(T.backoffMs, never)).toHaveLength(1);
  });
});
