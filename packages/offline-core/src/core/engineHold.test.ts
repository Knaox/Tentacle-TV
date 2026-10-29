/**
 * Ce qui tient la plateforme au-delà des transferts en vol (`engineHold.ts`).
 *
 * Le trou du 29/10 : une playlist gardée hors ligne dont les titres attendent que
 * l'extension les prépare (503 + `Retry-After`) n'a plus rien en vol — le moteur
 * se disait « libre », Android rendait son service et ses minuteurs, et la
 * relance programmée ne sonnait jamais application quittée.
 */

import { describe, expect, it, vi } from "vitest";
import type { TransferNet, TransferStream } from "./transferNet";
import type { HoldState } from "./engineHold";
import { enqueueMusicBatch, type MusicKeepItem } from "./musicKeep";
import { openInMemory } from "../node/nodeDatabase";
import { getFile } from "./queue";
import { CREDS, makeEngine, preparedRoot, rootWithThreeItems, seed } from "./testkit";

const header = (value: string | null) => (name: string) => (name === "retry-after" ? value : null);

/** Le serveur prépare : 503 + Retry-After, sans fin. */
const preparingNet: TransferNet = {
  async open(): Promise<TransferStream> {
    return { status: 503, header: header("1800"), chunks: (async function* () {})() };
  },
  async killTranscode() {
    /* rien */
  },
};

/** Un serveur muet : 502, une coupure ordinaire. */
const cutNet: TransferNet = {
  async open(): Promise<TransferStream> {
    return { status: 502, header: () => null, chunks: (async function* () {})() };
  },
  async killTranscode() {
    /* rien */
  },
};

function track(id: string): MusicKeepItem {
  return {
    trackKey: `ext:sillon:ytm:t:${id}`, origin: "external", sourcePath: `/api/plugins/sillon/music/offline/${id}`, variant: "original",
    preset: null, containerExt: "audio", expectedSize: null, estimatedSize: 3, title: id, artist: null, album: null, albumKey: null,
    discNumber: null, trackNumber: null, durationMs: 1_000, artworkPath: null, trackJson: "{}",
  };
}

describe("attente demandée par le serveur", () => {
  it("rien en vol mais des titres en préparation : le moteur reste TENU, et le dit", async () => {
    const db = openInMemory();
    const held: HoldState[] = [];
    const { engine, toggles } = makeEngine(db, preparedRoot(), preparingNet, {
      networkRetryDelaysMs: [5_000],
      musicParallelLimit: () => 3,
      onHeld: (state) => held.push(state),
    });
    const ids = enqueueMusicBatch(db, "u", [track("a"), track("b")], 1e12, 1_000).fileIds;

    engine.start(CREDS);
    await vi.waitFor(() => expect(ids.map((id) => getFile(db, id)?.nextRetryAt)).toEqual([1_801_000, 1_801_000]));

    // Plus rien ne transfère — `onBusy` redescend comme avant…
    expect(toggles.at(-1)).toBe(false);
    // …mais l'attente du serveur tient la plateforme.
    expect(engine.held()).toEqual({ transferring: false, awaitingRetry: true, awaitingServer: true });
    expect(held.at(-1)).toEqual({ transferring: false, awaitingRetry: true, awaitingServer: true });
    // Une fermeture les interromprait : ils comptent.
    expect(engine.pending()).toBe(2);
  });

  it("titres mis en pause ou annulés : plus rien ne tient", async () => {
    const db = openInMemory();
    const { engine } = makeEngine(db, preparedRoot(), preparingNet, { networkRetryDelaysMs: [5_000], musicParallelLimit: () => 3 });
    const [a, b] = enqueueMusicBatch(db, "u", [track("a"), track("b")], 1e12, 1_000).fileIds as [number, number];

    engine.start(CREDS);
    await vi.waitFor(() => expect(engine.held().awaitingServer).toBe(true));

    engine.pause(a);
    expect(engine.held().awaitingServer).toBe(true);
    engine.cancel(b);
    expect(engine.held()).toEqual({ transferring: false, awaitingRetry: false, awaitingServer: false });
    expect(engine.pending()).toBe(0);
  });
});

describe("relance d'une coupure", () => {
  it("un film coupé qui attend sa relance tient la plateforme, sans passer pour une attente du serveur", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const fileId = seed(db, "item1", 1_000);
    const { engine } = makeEngine(db, root, cutNet, { networkRetryDelaysMs: [5_000] });

    engine.start(CREDS);
    await vi.waitFor(() => expect(getFile(db, fileId)?.nextRetryAt).toBe(6_000));
    expect(engine.held()).toEqual({ transferring: false, awaitingRetry: true, awaitingServer: false });
  });

  it("sans relance programmée, rien ne tient une fois la file vide", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    seed(db, "item1", 1_000);
    const held: HoldState[] = [];
    const { engine } = makeEngine(db, root, cutNet, { onHeld: (state) => held.push(state) });

    engine.start(CREDS);
    await vi.waitFor(() => expect(held.at(-1)).toEqual({ transferring: false, awaitingRetry: false, awaitingServer: false }));
    expect(held[0]).toEqual({ transferring: true, awaitingRetry: false, awaitingServer: false });
  });
});
