/**
 * La copie gardée d'un titre, lue par le moteur audio : trouvée dans NOTRE base
 * pour CE compte seulement, revérifiée sur le disque, jamais un chemin venu de
 * la page.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openInMemory } from "../downloads/node/nodeDatabase";
import { nodeVolume } from "../downloads/node/nodeFiles";
import { enqueueMusicBatch } from "../downloads/core/musicKeep";
import { setStatus } from "../downloads/core/queue";

const state = vi.hoisted(() => ({ db: null as unknown, root: "" }));
vi.mock("../localDb", () => ({ localDb: () => state.db }));
vi.mock("../downloadsRuntime", () => ({ downloadsVolume: () => nodeVolume(state.root) }));

import { keptAudioPath, keptPathFor } from "./audioKept";

const ID = "0123456789abcdef0123456789abcdef";
const KEY = `jf:${ID}`;

beforeEach(() => {
  state.root = mkdtempSync(path.join(tmpdir(), "tentacle-kept-"));
  const db = openInMemory();
  state.db = db;
  const fileId = enqueueMusicBatch(db, "u1", [{
    trackKey: KEY, origin: "library", sourcePath: `/api/downloads/original/${ID}`, variant: "original", preset: null,
    containerExt: "flac", expectedSize: 4, estimatedSize: null, title: "Titre", artist: null, album: null, albumKey: null,
    discNumber: null, trackNumber: null, durationMs: null, artworkPath: null, trackJson: "{}",
  }], 1e12, 1, 0).fileIds[0]!;
  setStatus(db, fileId, "complete", null, 2);
});
afterEach(() => rmSync(state.root, { recursive: true, force: true }));

function writeAudio(bytes: string): string {
  const target = path.join(state.root, "media", ID, "audio-original.flac");
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  return target;
}

describe("keptAudioPath", () => {
  it("rend le fichier gardé par ce compte", () => {
    const target = writeAudio("flac");
    expect(keptAudioPath("u1", KEY)).toBe(target);
  });

  it("rien pour un autre compte ni un autre titre", () => {
    writeAudio("flac");
    expect(keptAudioPath("u2", KEY)).toBeNull();
    expect(keptAudioPath("u1", "jf:ffffffffffffffffffffffffffffffff")).toBeNull();
  });

  it("un fichier tronqué hors de l'application n'est jamais lu (le serveur reprend)", () => {
    writeAudio("fl");
    expect(keptAudioPath("u1", KEY)).toBeNull();
  });

  it("un fichier effacé non plus", () => {
    expect(keptAudioPath("u1", KEY)).toBeNull();
  });
});

describe("keptPathFor", () => {
  it("un titre qui a changé d'identité (entrée importée rapprochée) : la copie gardée sous l'ANCIENNE clé est lue", () => {
    const target = writeAudio("flac");
    expect(keptPathFor({ userId: "u1", trackKey: KEY }, "ext:sillon:ytm:t:nouvelle")).toBe(target);
    expect(keptPathFor({ userId: "u1" }, KEY)).toBe(target);
    expect(keptPathFor({ userId: "u1" }, "ext:sillon:ytm:t:nouvelle")).toBeNull();
    expect(keptPathFor(undefined, KEY)).toBeNull();
  });
});
