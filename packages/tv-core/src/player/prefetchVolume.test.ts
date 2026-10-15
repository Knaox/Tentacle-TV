import { describe, expect, it } from "vitest";
import {
  avPlayerForwardBufferSec, bufferedEnd, PREFETCH_VOLUME, prismPrefetch, streamByteRate,
} from "./prefetchVolume";

const MB = 1024 * 1024;

describe("le débit de la source", () => {
  it("la taille du fichier sur sa durée d'abord", () => {
    expect(streamByteRate({ sizeBytes: 200 * MB, durationSec: 1200, bitrateBps: 99_000_000 })).toBeCloseTo((200 * MB) / 1200);
  });

  it("sinon le débit annoncé, en octets", () => {
    expect(streamByteRate({ bitrateBps: 8_000_000 })).toBe(1_000_000);
    expect(streamByteRate({ sizeBytes: 200 * MB, bitrateBps: 8_000_000 })).toBe(1_000_000);
  });

  it("rien de connu : null", () => {
    expect(streamByteRate({})).toBeNull();
    expect(streamByteRate({ sizeBytes: 0, durationSec: 0, bitrateBps: Number.NaN })).toBeNull();
  });
});

describe("l'avance d'AVPlayer", () => {
  it("source distante : le budget mémoire en secondes de CE débit", () => {
    // 20 Mb/s = 2,5 Mo/s → 256 Mio ≈ 107 s.
    const s = avPlayerForwardBufferSec({ loopback: false, byteRate: 2_500_000, durationSec: 7200 });
    expect(s).toBe(Math.floor((256 * MB) / 2_500_000));
  });

  it("un épisode plus petit que le budget se précharge EN ENTIER", () => {
    // 200 Mo pour 20 min : la durée entière, pas plus.
    const rate = streamByteRate({ sizeBytes: 200 * MB, durationSec: 1200 });
    expect(avPlayerForwardBufferSec({ loopback: false, byteRate: rate, durationSec: 1200 })).toBe(1200);
  });

  it("jamais sous l'ancien plancher : une source très lourde garde 30 s", () => {
    // 4K remux à 120 Mb/s : 256 Mio ≈ 17 s → plancher.
    expect(avPlayerForwardBufferSec({ loopback: false, byteRate: 15_000_000, durationSec: 7200 })).toBe(30);
  });

  it("débit inconnu : l'ancien réglage, tel quel", () => {
    expect(avPlayerForwardBufferSec({ loopback: false, byteRate: null })).toBe(30);
  });

  it("bouclage PrismCore : 10 s en mémoire, l'avance est sur le disque", () => {
    expect(avPlayerForwardBufferSec({ loopback: true, byteRate: 100, durationSec: 7200 })).toBe(10);
  });
});

describe("l'avance de PrismCore", () => {
  it("le budget disque en secondes du débit de la source", () => {
    // Remux 4K à 64 Mb/s = 8 Mo/s → 1 Gio ≈ 134 s.
    const p = prismPrefetch({ byteRate: 8_000_000, durationSec: 7200 });
    expect(p.producerLeadSec).toBe(Math.floor((1024 * MB) / 8_000_000));
  });

  it("un épisode plus petit que le budget : tout le titre", () => {
    const rate = streamByteRate({ sizeBytes: 800 * MB, durationSec: 2700 });
    expect(prismPrefetch({ byteRate: rate, durationSec: 2700 }).producerLeadSec).toBe(2700);
  });

  it("jamais sous les 30 s d'avant, débit inconnu compris", () => {
    expect(prismPrefetch({ byteRate: null }).producerLeadSec).toBe(30);
    expect(prismPrefetch({ byteRate: 100_000_000, durationSec: 7200 }).producerLeadSec).toBe(30);
  });

  it("le budget de rétention dépasse TOUJOURS l'avance", () => {
    const p = prismPrefetch({ byteRate: 1_000_000 });
    expect(p.segmentCacheBytes).toBe(PREFETCH_VOLUME.diskBytes + PREFETCH_VOLUME.diskMarginBytes);
    expect(p.segmentCacheBytes).toBeGreaterThan(PREFETCH_VOLUME.diskBytes);
  });
});

describe("la barre de préchargement", () => {
  it("sans PrismCore : la fin de la mémoire d'AVPlayer", () => {
    expect(bufferedEnd({ position: 100, playable: 160, durationSec: 1200 })).toBe(160);
  });

  it("jamais derrière la position", () => {
    expect(bufferedEnd({ position: 100, playable: 0 })).toBe(100);
  });

  it("PrismCore : l'intervalle écrit qui contient la position, au-delà d'AVPlayer", () => {
    const ranges = [{ start: 0, end: 540 }];
    expect(bufferedEnd({ position: 100, playable: 110, ranges, durationSec: 1200 })).toBe(540);
  });

  it("un épisode entièrement écrit remplit la barre", () => {
    expect(bufferedEnd({ position: 30, playable: 40, ranges: [{ start: 0, end: 1200 }], durationSec: 1200 })).toBe(1200);
  });

  it("un bloc écrit plus loin, après un saut, n'est pas de l'avance continue", () => {
    const ranges = [{ start: 600, end: 900 }];
    expect(bufferedEnd({ position: 100, playable: 110, ranges })).toBe(110);
  });

  it("des intervalles qui se suivent à un segment près s'enchaînent, dans n'importe quel ordre", () => {
    const ranges = [{ start: 306, end: 500 }, { start: 0, end: 300 }];
    expect(bufferedEnd({ position: 10, playable: 20, ranges })).toBe(500);
  });

  it("jamais au-delà de la durée", () => {
    expect(bufferedEnd({ position: 10, playable: 20, ranges: [{ start: 0, end: 1300 }], durationSec: 1200 })).toBe(1200);
  });
});
