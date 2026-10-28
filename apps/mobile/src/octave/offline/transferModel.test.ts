/**
 * Les transferts de la musique gardée : le lot courant (« 2 sur 4 »), les octets
 * estimés d'un titre dont la taille n'est pas connue, le temps restant d'après le
 * débit mesuré, la file dans son ordre, et le débit tenu entre deux titres.
 */

import { describe, expect, it } from "vitest";
import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import { LOT_GAP_MS, RATE_HOLD_MS, STALL_MS, holdRate, isStalled, trackAdvance, transferSummary } from "./transferModel";

let nextId = 1;
function kept(partial: Partial<KeptMusicTrack> = {}): KeptMusicTrack {
  const fileId = partial.fileId ?? nextId++;
  return {
    fileId, itemId: `i${fileId}`, trackKey: `jf:${fileId}`, origin: "library", variant: "original", preset: null, status: "complete", errorCode: null,
    pausedByUser: false, bytesDone: 100, expectedSize: 100, title: `t${fileId}`, artist: null, album: null, albumKey: null, discNumber: null,
    trackNumber: null, durationMs: 1000, coverRel: null, sourcePath: null, trackJson: "{}", createdAt: 10, ...partial,
  };
}

const noRate = () => undefined;

describe("transferSummary", () => {
  it("rien en cours : carte absente", () => {
    const s = transferSummary([kept(), kept({ status: "canceled" })], noRate);
    expect(s.active).toBe(false);
    expect(s.queue).toEqual([]);
  });

  it("le lot commence au plus ancien titre en cours, pas à la discothèque d'hier", () => {
    const tracks = [
      kept({ createdAt: 1 }), kept({ createdAt: 2 }), // gardés hier
      kept({ createdAt: 1 + LOT_GAP_MS * 3 }), kept({ createdAt: 2 + LOT_GAP_MS * 3 }), // même demande, déjà arrivés
      kept({ createdAt: 3 + LOT_GAP_MS * 3, status: "downloading", bytesDone: 50 }), kept({ createdAt: 4 + LOT_GAP_MS * 3, status: "queued", bytesDone: 0 }),
    ];
    const s = transferSummary(tracks, noRate);
    expect(s).toMatchObject({ active: true, done: 2, total: 4, running: 2, bytesDone: 250, bytesTotal: 400 });
    expect(s.fraction).toBeCloseTo(250 / 400);
  });

  it("une taille inconnue est estimée d'après la moyenne, et le dit", () => {
    const s = transferSummary([kept({ bytesDone: 200, expectedSize: 200 }), kept({ status: "queued", bytesDone: 0, expectedSize: null })], noRate);
    expect(s.bytesTotal).toBe(400);
    expect(s.estimated).toBe(true);
  });

  it("aucune taille connue : la barre suit les titres", () => {
    const s = transferSummary([kept({ status: "queued", bytesDone: 0, expectedSize: null }), kept({ status: "queued", bytesDone: 0, expectedSize: null })], noRate);
    expect(s.bytesTotal).toBeNull();
    expect(s.fraction).toBe(0);
    expect(s.etaMs).toBeNull();
  });

  it("temps restant : ce qui doit encore partir, au débit mesuré ; ni les défauts ni les pauses voulues", () => {
    const a = kept({ status: "downloading", bytesDone: 400, expectedSize: 1_000 });
    const tracks = [a, kept({ status: "queued", bytesDone: 0, expectedSize: 1_000 }), kept({ status: "error", bytesDone: 0, expectedSize: 1_000 }), kept({ status: "paused", pausedByUser: true, bytesDone: 0, expectedSize: 1_000 })];
    const s = transferSummary(tracks, (id) => (id === a.fileId ? { rateBps: 200 } : undefined));
    expect(s.rateBps).toBe(200);
    expect(s.etaMs).toBe(((600 + 1_000) / 200) * 1_000);
    expect(s).toMatchObject({ failed: 1, pausedByUser: 1, running: 2 });
  });

  it("tout en pause voulue : pas de temps restant", () => {
    const s = transferSummary([kept({ status: "paused", pausedByUser: true, bytesDone: 10 })], () => ({ rateBps: 500 }));
    expect(s.etaMs).toBeNull();
    expect(s.running).toBe(0);
  });

  it("la file : ce qui arrive, se prépare, attend, en pause, en défaut", () => {
    const failed = kept({ status: "error", createdAt: 10 });
    const paused = kept({ status: "paused", pausedByUser: true, createdAt: 11 });
    const waiting = kept({ status: "queued", createdAt: 12 });
    const preparing = kept({ status: "downloading", preparing: true, createdAt: 13 });
    const moving = kept({ status: "downloading", createdAt: 14 });
    const order = transferSummary([failed, paused, waiting, preparing, moving], noRate).queue.map((k) => k.fileId);
    expect(order).toEqual([moving, preparing, waiting, paused, failed].map((k) => k.fileId));
  });
});

describe("holdRate", () => {
  it("garde la dernière mesure le temps qu'un titre passe au suivant, puis l'oublie", () => {
    const first = holdRate(null, 1_000, 0);
    expect(holdRate(first, null, RATE_HOLD_MS - 1).rateBps).toBe(1_000);
    expect(holdRate(first, null, RATE_HOLD_MS).rateBps).toBeNull();
    expect(holdRate(first, 2_000, 10).rateBps).toBe(2_000);
  });
});

describe("trackAdvance / isStalled", () => {
  it("bloqué après STALL_MS sans un octet de plus, débloqué au premier octet", () => {
    const start = trackAdvance(null, 100, 0);
    const same = trackAdvance(start, 100, STALL_MS);
    expect(isStalled(same, 1, STALL_MS)).toBe(true);
    expect(isStalled(same, 1, STALL_MS - 1)).toBe(false);
    expect(isStalled(trackAdvance(same, 101, STALL_MS), 1, STALL_MS)).toBe(false);
  });

  it("rien en cours (tout en pause voulue, défauts) : jamais bloqué", () => {
    expect(isStalled({ bytes: 0, atMs: 0 }, 0, STALL_MS * 10)).toBe(false);
  });
});
