import { describe, expect, it, vi } from "vitest";
import { INITIAL_SNAPSHOT, type PlayerSnapshot } from "@tentacle-tv/shared/octave";
import type { MusicTrack } from "@tentacle-tv/shared/music";

vi.mock("../offline/keptMusic", () => ({ subscribeKeptMusic: () => () => undefined }));
vi.mock("../offline/keptPlayback", () => ({ keptPlaybackSource: () => null }));

const { keptSwapTargets } = await import("./keptCopySwap");

/** La bascule vers la copie du téléphone : seulement ce qui joue ENCORE depuis le serveur. */

const track = (key: string) => ({ key, title: key, artists: [] }) as unknown as MusicTrack;
const items = [
  { uid: "u1", track: track("jf:a") },
  { uid: "u2", track: track("jf:b") },
];

function state(patch: Partial<PlayerSnapshot> = {}, next: { uid: string | null; fromDevice: boolean } = { uid: "u2", fromDevice: false }) {
  return {
    snapshot: { ...INITIAL_SNAPSHOT, phase: "playing", fromDevice: false, queue: { ...INITIAL_SNAPSHOT.queue, items, cursor: 0 }, ...patch } as PlayerSnapshot,
    engineKeys: new Map([
      ["u1", "jf:a"],
      ["u2", "jf:b"],
    ]),
    nextUid: next.uid,
    nextFromDevice: next.fromDevice,
  };
}

describe("keptSwapTargets", () => {
  it("le titre en cours lu du serveur passe au fichier dès que sa copie est là", () => {
    expect(keptSwapTargets(state(), (k) => k === "jf:a")).toEqual(["jf:a"]);
  });

  it("le suivant déjà donné au moteur aussi", () => {
    expect(keptSwapTargets(state(), () => true)).toEqual(["jf:a", "jf:b"]);
  });

  it("rien quand le courant joue déjà depuis le téléphone, ou sans copie", () => {
    expect(keptSwapTargets(state({ fromDevice: true }, { uid: "u2", fromDevice: true }), () => true)).toEqual([]);
    expect(keptSwapTargets(state(), () => false)).toEqual([]);
  });

  it("pendant un départ, le lecteur choisit sa source lui-même", () => {
    expect(keptSwapTargets(state({ phase: "starting" }, { uid: null, fromDevice: false }), () => true)).toEqual([]);
  });
});
