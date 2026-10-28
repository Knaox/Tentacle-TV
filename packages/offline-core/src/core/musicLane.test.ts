/**
 * Plusieurs titres de musique à la fois quand la plateforme le demande (le
 * bureau), un film toujours seul, et rien de changé sans la demande (le mobile).
 */

import { describe, expect, it } from "vitest";
import { openInMemory } from "../node/nodeDatabase";
import { enqueueMusicBatch, type MusicKeepItem } from "./musicKeep";
import { mayStart } from "./musicLane";
import type { TransferNet, TransferStream } from "./transferNet";
import { CREDS, makeEngine, preparedRoot, seed } from "./testkit";

const LANES = { all: 1, music: 3 };

describe("mayStart", () => {
  it("un titre part à côté d'autres titres, jusqu'au plafond de la musique", () => {
    expect(mayStart({ music: true }, { total: 0, music: 0 }, LANES)).toBe(true);
    expect(mayStart({ music: true }, { total: 2, music: 2 }, LANES)).toBe(true);
    expect(mayStart({ music: true }, { total: 3, music: 3 }, LANES)).toBe(false);
  });

  it("jamais un film à côté d'un titre, ni l'inverse", () => {
    expect(mayStart({ music: false }, { total: 1, music: 1 }, LANES)).toBe(false);
    expect(mayStart({ music: true }, { total: 1, music: 0 }, LANES)).toBe(false);
    expect(mayStart({ music: false }, { total: 0, music: 0 }, LANES)).toBe(true);
  });

  it("sans places de musique : la règle d'avant (le mobile)", () => {
    expect(mayStart({ music: true }, { total: 1, music: 1 }, { all: 1, music: 0 })).toBe(false);
    expect(mayStart({ music: true }, { total: 1, music: 1 }, { all: 2, music: 0 })).toBe(true);
    expect(mayStart({ music: false }, { total: 1, music: 0 }, { all: 2, music: 0 })).toBe(true);
  });
});

/** Un serveur qui ne répond jamais : on compte les demandes parties. */
function silentNet(): { net: TransferNet; urls: string[] } {
  const urls: string[] = [];
  return {
    urls,
    net: {
      open: (url) => {
        urls.push(url);
        return new Promise<TransferStream>(() => undefined);
      },
      killTranscode: async () => undefined,
    },
  };
}

const item = (n: number): MusicKeepItem => ({
  trackKey: `ext:sillon:ytm:t:bnch000000${n}`,
  origin: "external",
  sourcePath: `/api/plugins/sillon/music/offline/ytm%3At%3Abnch000000${n}`,
  variant: "original",
  preset: null,
  containerExt: "audio",
  expectedSize: null,
  estimatedSize: 1_000,
  title: `Titre ${n}`,
  artist: null,
  album: null,
  albumKey: null,
  discNumber: null,
  trackNumber: null,
  durationMs: null,
  artworkPath: null,
  trackJson: "{}",
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

describe("le moteur et les places de musique", () => {
  it("le bureau en demande trois : trois titres partent ensemble, le quatrième attend", async () => {
    const db = openInMemory();
    const server = silentNet();
    const { engine } = makeEngine(db, preparedRoot(), server.net, { musicParallelLimit: () => 3 });
    enqueueMusicBatch(db, "u", [1, 2, 3, 4].map(item), 1e12, 1_000);
    engine.start(CREDS);
    await flush();
    expect(server.urls).toHaveLength(3);
    expect(engine.pending()).toBe(4);
  });

  it("sans la demande (le mobile) : un seul à la fois, comme avant", async () => {
    const db = openInMemory();
    const server = silentNet();
    const { engine } = makeEngine(db, preparedRoot(), server.net);
    enqueueMusicBatch(db, "u", [1, 2, 3].map(item), 1e12, 1_000);
    engine.start(CREDS);
    await flush();
    expect(server.urls).toHaveLength(1);
  });

  it("un film en tête de file part seul ; les titres derrière l'attendent", async () => {
    const db = openInMemory();
    const server = silentNet();
    const { engine } = makeEngine(db, preparedRoot(), server.net, { musicParallelLimit: () => 3 });
    seed(db, "item1", 500);
    enqueueMusicBatch(db, "u", [1, 2].map(item), 1e12, 1_000);
    engine.start(CREDS);
    await flush();
    expect(server.urls).toHaveLength(1);
    expect(server.urls[0]).toContain("/api/downloads/original/item1");
  });

  it("l'iPhone qui se verrouille en demande vingt-quatre : vingt-quatre titres partent avant la suspension", async () => {
    const db = openInMemory();
    const server = silentNet();
    const { engine } = makeEngine(db, preparedRoot(), server.net, { parallelLimit: () => 3, musicParallelLimit: () => 24 });
    enqueueMusicBatch(db, "u", Array.from({ length: 30 }, (_, n) => item(n + 1)), 1e12, 1_000);
    engine.start(CREDS);
    await flush();
    expect(server.urls).toHaveLength(24);
  });

  it("un plafond démesuré est borné (vingt-quatre au plus)", async () => {
    const db = openInMemory();
    const server = silentNet();
    const { engine } = makeEngine(db, preparedRoot(), server.net, { musicParallelLimit: () => 50 });
    enqueueMusicBatch(db, "u", Array.from({ length: 30 }, (_, n) => item(n + 1)), 1e12, 1_000);
    engine.start(CREDS);
    await flush();
    expect(server.urls).toHaveLength(24);
  });
});
