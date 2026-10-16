import { describe, expect, it } from "vitest";
import type { PlayerTimers } from "../player/playerTimers";
import { PREVIEW_PARK_MAX_MS, PREVIEW_PARK_QUIET_MS, createPreviewParking, previewParkReleaseAt } from "./trailerPreviewPark";

describe("previewParkReleaseAt — la vidéo garée se démonte au calme", () => {
  it("télécommande déjà au calme : aussitôt garée, aussitôt démontée", () => {
    expect(previewParkReleaseAt({ parkedAt: 1_000, lastInputAt: 0 })).toBe(1_000);
    expect(previewParkReleaseAt({ parkedAt: 1_000, lastInputAt: null })).toBe(1_000);
  });

  it("une flèche récente : le démontage attend le calme après elle", () => {
    // Le flou (la flèche) à 0, la fin du fondu de sortie à 220.
    expect(previewParkReleaseAt({ parkedAt: 220, lastInputAt: 0 })).toBe(PREVIEW_PARK_QUIET_MS);
    expect(previewParkReleaseAt({ parkedAt: 220, lastInputAt: 900 })).toBe(900 + PREVIEW_PARK_QUIET_MS);
  });

  it("une rafale qui ne cesse pas : démontée au plus tard au plafond", () => {
    expect(previewParkReleaseAt({ parkedAt: 220, lastInputAt: 220 + PREVIEW_PARK_MAX_MS })).toBe(220 + PREVIEW_PARK_MAX_MS);
  });
});

/** Une horloge factice et une télécommande qu'on actionne à la main. */
function bench() {
  let now = 0;
  let pending: Array<{ at: number; fn: () => void; id: number }> = [];
  let ids = 0;
  const timers: PlayerTimers = {
    now: () => now,
    setTimeout: (fn, ms) => {
      ids += 1;
      pending.push({ at: now + ms, fn, id: ids });
      return ids;
    },
    clearTimeout: (handle) => {
      pending = pending.filter((entry) => entry.id !== handle);
    },
  };
  const listeners = new Set<() => void>();
  const parking = createPreviewParking((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, timers);
  const advance = (to: number) => {
    for (;;) {
      const due = pending.filter((entry) => entry.at <= to).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      pending = pending.filter((entry) => entry !== due);
      now = due.at;
      due.fn();
    }
    now = to;
  };
  const press = (at: number) => {
    advance(at);
    for (const listener of [...listeners]) listener();
  };
  return { parking, advance, press, listening: () => listeners.size };
}

describe("createPreviewParking — le garage de l'appareil", () => {
  it("une rafale de flèches : rien ne se démonte avant le calme qui la suit", () => {
    const { parking, advance, press } = bench();
    const stop = parking.watch();
    press(0); // le flou de la carte en aperçu
    advance(220); // fin du fondu de sortie : garée
    const released: number[] = [];
    let at = 220;
    parking.park(() => released.push(at));
    for (const step of [250, 450, 650]) press(step);
    at = 650 + PREVIEW_PARK_QUIET_MS - 1;
    advance(at);
    expect(released).toEqual([]);
    at = 650 + PREVIEW_PARK_QUIET_MS;
    advance(at);
    expect(released).toEqual([650 + PREVIEW_PARK_QUIET_MS]);
    stop();
  });

  it("télécommande au calme au moment du garage : démontée aussitôt", () => {
    const { parking } = bench();
    let released = 0;
    parking.park(() => (released += 1));
    expect(released).toBe(1);
  });

  it("un autre aperçu prend la place : la vidéo garée se démonte aussitôt", () => {
    const { parking, press } = bench();
    parking.watch();
    press(0);
    let released = 0;
    parking.park(() => (released += 1));
    parking.releaseAll();
    expect(released).toBe(1);
    parking.releaseAll();
    expect(released).toBe(1);
  });

  it("annulée (la session démontée autrement) : plus rien ne la démonte", () => {
    const { parking, advance, press } = bench();
    parking.watch();
    press(0);
    let released = 0;
    const cancel = parking.park(() => (released += 1));
    cancel();
    advance(10_000);
    expect(released).toBe(0);
  });

  it("la télécommande n'est suivie que tant qu'une vidéo existe", () => {
    const { parking, listening } = bench();
    expect(listening()).toBe(0);
    const a = parking.watch();
    const b = parking.watch();
    expect(listening()).toBe(1);
    a();
    a();
    expect(listening()).toBe(1);
    b();
    expect(listening()).toBe(0);
  });
});
