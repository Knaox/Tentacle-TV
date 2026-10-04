import { describe, expect, it } from "vitest";
import {
  SEEK_SETTLE_MS, SEEK_SLOW_HINT_MS, SEEK_TIMEOUT_MS,
  accumulateSeek, nextSeekWaitChange, seekDueAt, seekLanded, seekWaitPhase,
} from "./transcodeSeek";

describe("accumulateSeek", () => {
  it("cumule les écarts depuis la cible précédente, pas depuis une position périmée", () => {
    let pending = accumulateSeek(null, { by: 30 }, 100, 0, 3600);
    pending = accumulateSeek(pending, { by: 30 }, 100, 200, 3600);
    pending = accumulateSeek(pending, { by: -10 }, 100, 400, 3600);
    expect(pending).toEqual({ target: 150, lastAt: 400 });
  });

  it("une position visée remplace la cible, bornée au film", () => {
    expect(accumulateSeek({ target: 50, lastAt: 0 }, { to: 4000 }, 0, 10, 3600).target).toBe(3600);
    expect(accumulateSeek(null, { by: -30 }, 10, 0, 3600).target).toBe(0);
    // Durée inconnue : rien en haut.
    expect(accumulateSeek(null, { by: 30 }, 5000, 0, 0).target).toBe(5030);
  });

  it("n'applique les sauts qu'après le calme du dernier appui", () => {
    expect(seekDueAt({ target: 1, lastAt: 1000 })).toBe(1000 + SEEK_SETTLE_MS);
  });
});

describe("seekWaitPhase", () => {
  it("indicateur tout de suite, phrase après 5 s, échec au délai", () => {
    expect(seekWaitPhase(null, 0)).toBe("idle");
    expect(seekWaitPhase(0, 0)).toBe("loading");
    expect(seekWaitPhase(0, SEEK_SLOW_HINT_MS - 1)).toBe("loading");
    expect(seekWaitPhase(0, SEEK_SLOW_HINT_MS)).toBe("slow");
    expect(seekWaitPhase(0, SEEK_TIMEOUT_MS)).toBe("failed");
    expect(SEEK_SLOW_HINT_MS).toBe(5_000);
  });

  it("dit quand armer le prochain minuteur", () => {
    expect(nextSeekWaitChange(null, 0)).toBeNull();
    expect(nextSeekWaitChange(1000, 1000)).toBe(1000 + SEEK_SLOW_HINT_MS);
    expect(nextSeekWaitChange(1000, 1000 + SEEK_SLOW_HINT_MS)).toBe(1000 + SEEK_TIMEOUT_MS);
    expect(nextSeekWaitChange(1000, 1000 + SEEK_TIMEOUT_MS)).toBeNull();
  });
});

describe("seekLanded", () => {
  it("aboutit quand la vidéo avance au passage visé", () => {
    expect(seekLanded({ target: 600, position: 598.5, advancing: true, buffering: false })).toBe(true);
    expect(seekLanded({ target: 600, position: 606, advancing: true, buffering: false })).toBe(true);
  });

  it("n'aboutit ni en chargement, ni à l'arrêt, ni à l'ancienne position", () => {
    expect(seekLanded({ target: 600, position: 600, advancing: true, buffering: true })).toBe(false);
    expect(seekLanded({ target: 600, position: 600, advancing: false, buffering: false })).toBe(false);
    expect(seekLanded({ target: 600, position: 120, advancing: true, buffering: false })).toBe(false);
  });
});
