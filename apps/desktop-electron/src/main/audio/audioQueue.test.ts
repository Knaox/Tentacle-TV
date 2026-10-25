import { describe, expect, it } from "vitest";
import type { AudioBridgeSource, AudioBridgeTrack } from "./audioBridgeContract";
import { AudioQueue, type QueueOp, type SwapContext } from "./audioQueue";

const track = (key: string, albumKey: string | null = "a"): AudioBridgeTrack => ({ trackKey: key, albumKey, durationMs: 200_000, format: null });
const src = (name: string, complete = true, origin: "library" | "plugin" = "library"): AudioBridgeSource => ({
  url: `http://s/${name}`, origin, complete, sizeBytes: null, durationMs: null, replayGain: null, expiresAt: null,
});
const playing: SwapContext = { positionS: 10, started: true, atEnd: false, swapAtS: 11.5 };

/** Les opérations sous une forme lisible : `load:replace:t1@1`, `remove:0`… */
function shape(ops: QueueOp[]): string[] {
  return ops.map((op) => {
    if (op.op === "load") return `load:${op.mode}:${op.entry.source.url.slice(9)}@${op.entry.mpvId}`;
    if (op.op === "remove") return `remove:${op.index}`;
    if (op.op === "setEnd" || op.op === "seek") return `${op.op}:${op.seconds}`;
    return op.op;
  });
}

describe("la liste de mpv — enchaînement", () => {
  it("joue le titre puis confie le suivant à mpv (préchargé, sans blanc)", () => {
    const q = new AudioQueue();
    expect(shape(q.play(track("t1"), src("1"), null).ops)).toEqual(["load:replace:1@1"]);
    expect(shape(q.setNext(track("t2"), src("2")).ops)).toEqual(["load:append:2@2"]);
    expect(q.startFile(1)?.notices).toEqual([]);
    const advanced = q.startFile(2);
    expect(advanced?.notices).toEqual([{ type: "advanced", fromKey: "t1", toKey: "t2" }]);
    // Le titre fini quitte la liste de mpv : elle garde sa forme.
    expect(shape(advanced?.ops ?? [])).toEqual(["remove:0"]);
    expect(q.current()?.track.trackKey).toBe("t2");
  });

  it("remplace le suivant déjà confié quand la file change", () => {
    const q = new AudioQueue();
    q.play(track("t1"), src("1"), null);
    q.setNext(track("t2"), src("2"));
    expect(shape(q.setNext(track("t3"), src("3")).ops)).toEqual(["remove:1", "load:append:3@3"]);
    expect(shape(q.setNext(null, null).ops)).toEqual(["remove:1"]);
  });

  it("RETIENT le suivant tant que le titre en cours est incomplet", () => {
    const q = new AudioQueue();
    q.play(track("t1"), src("1", false, "plugin"), null);
    expect(q.setNext(track("t2"), src("2")).ops).toEqual([]);
    expect(q.nextTrack()?.track.trackKey).toBe("t2");
    // Vraie fin : il part, annoncé comme un enchaînement.
    const r = q.advanceHeld();
    expect(shape(r?.ops ?? [])).toEqual(["load:replace:2@2"]);
    expect(q.startFile(2)?.notices).toEqual([{ type: "advanced", fromKey: "t1", toKey: "t2" }]);
  });

  it("un départ inconnu n'est pas interprété", () => {
    const q = new AudioQueue();
    q.play(track("t1"), src("1"), null);
    expect(q.startFile(99)).toBeNull();
  });

  it("un ajout refusé par mpv recale les identifiants suivants", () => {
    const q = new AudioQueue();
    q.play(track("t1"), src("1"), null);
    q.setNext(track("t2"), src("2"));
    q.loadFailed(2);
    expect(shape(q.setNext(track("t3"), src("3")).ops)).toEqual(["load:append:3@2"]);
  });
});

describe("la liste de mpv — bascule à chaud", () => {
  it("bascule le titre EN COURS par la fin posée à T et la nouvelle source insérée à T", () => {
    const q = new AudioQueue();
    q.play(track("t1"), src("cache", false, "plugin"), null);
    q.startFile(1);
    q.setNext(track("t2"), src("2"));
    const r = q.swap("t1", src("lib"), playing);
    // Le suivant, retenu (titre incomplet), part derrière la source complète.
    expect(shape(r?.ops ?? [])).toEqual(["setEnd:11.5", "load:insert-next:lib@2", "load:append:2@3"]);
    // Jamais `start=` (un saut, qui vide la sortie) : une EDL qui commence à T.
    expect(q.pendingSwap()?.startS).toBeNull();
    expect(q.pendingSwap()?.edlFromS).toBe(11.5);
    const started = q.startFile(2);
    expect(started?.notices).toEqual([{ type: "swapped", trackKey: "t1", origin: "library" }]);
    expect(shape(started?.ops ?? [])).toEqual(["remove:0"]);
    // L'ancienne clé est GARDÉE (contrat) : seule la source change.
    expect(q.current()?.track.trackKey).toBe("t1");
    expect(q.current()?.source.origin).toBe("library");
    // Puis le suivant enchaîne comme d'habitude.
    expect(q.startFile(3)?.notices).toEqual([{ type: "advanced", fromKey: "t1", toKey: "t2" }]);
  });

  it("bascule le SUIVANT déjà préchargé sans toucher au titre en cours", () => {
    const q = new AudioQueue();
    q.play(track("t1"), src("1"), null);
    q.startFile(1);
    q.setNext(track("t2"), src("cache2", true, "plugin"));
    expect(shape(q.swap("t2", src("lib2"), playing)?.ops ?? [])).toEqual(["remove:1", "load:append:lib2@3"]);
    expect(q.nextTrack()?.track.trackKey).toBe("t2");
    expect(q.startFile(3)?.notices).toEqual([{ type: "advanced", fromKey: "t1", toKey: "t2" }]);
  });

  it("sans la place avant la fin : la source change pour les relectures, le son ne bouge pas", () => {
    const q = new AudioQueue();
    q.play(track("t1"), src("cache", false, "plugin"), null);
    q.startFile(1);
    const r = q.swap("t1", src("lib"), { ...playing, swapAtS: null });
    expect(r?.ops).toEqual([]);
    expect(r?.notices).toEqual([{ type: "swapped", trackKey: "t1", origin: "library" }]);
    expect(q.current()?.source.url).toBe("http://s/lib");
  });

  it("pas encore lancé, ou arrêté sur une fin : relit la nouvelle source à la position", () => {
    const q = new AudioQueue();
    q.play(track("t1"), src("cache", false, "plugin"), 30);
    expect(shape(q.swap("t1", src("lib"), { ...playing, started: false })?.ops ?? [])).toEqual(["load:replace:lib@2"]);
    expect(q.current()?.startS).toBe(30);
    expect(q.startFile(2)?.notices).toEqual([{ type: "swapped", trackKey: "t1", origin: "library" }]);
  });

  it("un saut pendant une bascule en attente EST la bascule", () => {
    const q = new AudioQueue();
    q.play(track("t1"), src("cache", false, "plugin"), null);
    q.startFile(1);
    q.swap("t1", src("lib"), playing);
    const r = q.seek(42);
    expect(shape(r.ops)).toEqual(["load:replace:lib@3"]);
    expect(q.current()?.startS).toBe(42);
  });

  it("une seconde bascule remplace la première et sa fin", () => {
    const q = new AudioQueue();
    q.play(track("t1"), src("cache", false, "plugin"), null);
    q.startFile(1);
    q.swap("t1", src("libA"), playing);
    expect(shape(q.swap("t1", src("libB"), { ...playing, swapAtS: 12.5 })?.ops ?? [])).toEqual([
      "remove:1", "setEnd:12.5", "load:insert-next:libB@3",
    ]);
    expect(shape(q.swap("t1", src("libC"), { ...playing, swapAtS: null })?.ops ?? [])).toEqual(["remove:1", "clearEnd"]);
  });

  it("un titre ni courant ni suivant : rien (le moteur garde la source)", () => {
    const q = new AudioQueue();
    q.play(track("t1"), src("1"), null);
    expect(q.swap("t9", src("x"), playing)).toBeNull();
  });
});

describe("la liste de mpv — après une bascule (entrée EDL)", () => {
  function swappedQueue(): AudioQueue {
    const q = new AudioQueue();
    q.play(track("t1"), src("cache", false, "plugin"), null);
    q.startFile(1);
    q.swap("t1", src("lib"), playing);
    q.startFile(2);
    return q;
  }

  it("un saut après T vise la chronologie de l'EDL, un saut avant T relit la source", () => {
    const q = swappedQueue();
    expect(shape(q.seek(20).ops)).toEqual(["seek:8.5"]);
    expect(shape(q.seek(3).ops)).toEqual(["load:replace:lib@3"]);
    expect(q.current()?.startS).toBe(3);
    expect(q.current()?.edlFromS).toBeNull();
  });

  it("une seconde bascule pose la fin dans la chronologie de l'EDL", () => {
    const q = swappedQueue();
    expect(shape(q.swap("t1", src("lib2"), { ...playing, positionS: 20, swapAtS: 21.5 })?.ops ?? [])).toEqual([
      "setEnd:10", "load:insert-next:lib2@3",
    ]);
  });
});

describe("la liste de mpv — fichier en écriture entièrement en cache", () => {
  it("le suivant retenu part dans mpv : enchaînement sans blanc", () => {
    const q = new AudioQueue();
    q.play(track("t1"), src("cache", false, "plugin"), null);
    q.startFile(1);
    q.setNext(track("t2"), src("2"));
    expect(shape(q.markCurrentComplete().ops)).toEqual(["load:append:2@2"]);
    expect(q.markCurrentComplete().ops).toEqual([]);
  });
});

describe("la liste de mpv — relecture et arrêt", () => {
  it("relit la source en cours à la position, le suivant retenu reste retenu", () => {
    const q = new AudioQueue();
    q.play(track("t1"), src("cache", false, "plugin"), null);
    q.startFile(1);
    q.setNext(track("t2"), src("2"));
    expect(shape(q.reload(12.3).ops)).toEqual(["load:replace:cache@2"]);
    expect(q.startFile(2)?.notices).toEqual([]);
    expect(q.nextTrack()?.track.trackKey).toBe("t2");
  });

  it("stop vide tout", () => {
    const q = new AudioQueue();
    q.play(track("t1"), src("1"), null);
    expect(shape(q.stop().ops)).toEqual(["stop"]);
    expect(q.current()).toBeNull();
  });

  it("le ReplayGain auto voit l'album voisin", () => {
    const q = new AudioQueue();
    q.play(track("t1", "A"), src("1"), null);
    const r = q.setNext(track("t2", "A"), src("2"));
    const load = r.ops[0];
    expect(load?.op === "load" ? load.entry.neighbours : null).toEqual(["A"]);
  });
});
