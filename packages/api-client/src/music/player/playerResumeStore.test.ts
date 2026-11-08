import { afterEach, describe, expect, it, vi } from "vitest";
import type { SavedPlayback, SyncStorage } from "@tentacle-tv/shared/octave";
import { createPlayerResumeWriter, OCTAVE_PLAYER_KEY, parseStoredPlayers } from "./playerResumeStore";

/** Le stockage de la reprise : une clé pour toutes les identités, écrite sans tout relire (lot « bat »). */

function memory(initial?: string) {
  const data: Record<string, string> = initial ? { [OCTAVE_PLAYER_KEY]: initial } : {};
  const storage: SyncStorage & { writes: number } = {
    writes: 0,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      storage.writes += 1;
      data[k] = v;
    },
  };
  return { data, storage };
}

const playback = (positionMs: number): SavedPlayback => ({ v: 1, tracks: [], cursor: 0, original: [], shuffle: false, repeat: "off", contextId: null, positionMs });
const stored = (storage: SyncStorage) => parseStoredPlayers(storage.getItem(OCTAVE_PLAYER_KEY));

afterEach(() => vi.restoreAllMocks());

describe("écrivain de la reprise", () => {
  it("garde les autres identités, au plus quatre, les plus récentes d'abord", () => {
    const others = Object.fromEntries(["a", "b", "c", "d"].map((o, i) => [o, { playback: null, at: i + 1, launch: "L" }]));
    const { storage } = memory(JSON.stringify(others));
    createPlayerResumeWriter(storage).write("moi", playback(5_000), 100, "L1");
    const all = stored(storage);
    expect(Object.keys(all)).toEqual(["moi", "d", "c", "b"]);
    expect(all.moi).toEqual({ playback: playback(5_000), at: 100, launch: "L1" });
    expect(all.d).toEqual(others.d);
  });

  it("ne reparse pas la clé tant qu'elle n'a pas changé sous lui", () => {
    const { storage } = memory(JSON.stringify({ autre: { playback: playback(1), at: 1, launch: "L" } }));
    const writer = createPlayerResumeWriter(storage);
    const parse = vi.spyOn(JSON, "parse");
    for (let i = 1; i <= 5; i += 1) writer.write("moi", playback(i * 30_000), 10 + i, "L1");
    expect(parse).toHaveBeenCalledTimes(1);
    expect(storage.writes).toBe(5);
    expect(stored(storage).autre?.at).toBe(1);
  });

  it("relit la clé qu'un autre (onglet, compte) a changée : rien de lui n'est perdu", () => {
    const { storage } = memory();
    const writer = createPlayerResumeWriter(storage);
    writer.write("moi", playback(1_000), 10, "L1");
    const other = createPlayerResumeWriter(storage);
    other.write("autre", playback(9_000), 20, "L2");
    writer.write("moi", playback(2_000), 30, "L1");
    expect(stored(storage).autre?.playback?.positionMs).toBe(9_000);
    expect(stored(storage).moi?.playback?.positionMs).toBe(2_000);
  });

  it("une session identique à celle déjà écrite n'écrit rien ; un autre lancement, si", () => {
    const { storage } = memory();
    const writer = createPlayerResumeWriter(storage);
    writer.write("moi", playback(1_000), 10, "L1");
    writer.write("moi", playback(1_000), 40, "L1");
    expect(storage.writes).toBe(1);
    writer.write("moi", playback(1_000), 50, "L2");
    expect(storage.writes).toBe(2);
  });
});
