import { describe, expect, it } from "vitest";
import type { AudioBridgeSource, AudioBridgeTrack } from "./audioBridgeContract";
import { FileEnds, type EndsHost } from "./audioEngineEnds";
import { freshFlags, NO_PROPS } from "./audioEngineState";
import { AudioQueue, type QueueOp, type QueueResult } from "./audioQueue";
import { CUT_MARGIN_MS, CUT_PROGRESS_MS, CutReloads, isCut, MAX_CUT_RELOADS } from "./cutRecovery";

const track = (key: string): AudioBridgeTrack => ({ trackKey: key, albumKey: "a", durationMs: 200_000, format: null });
const src = (name: string, origin: AudioBridgeSource["origin"] = "plugin"): AudioBridgeSource => ({
  url: `http://s/${name}`, origin, complete: true, sizeBytes: null, durationMs: null, replayGain: null, expiresAt: null,
});
const shape = (ops: QueueOp[]): string[] =>
  ops.map((op) => (op.op === "load" ? `load:${op.mode}:${op.entry.source.url.slice(9)}@${op.entry.mpvId}${op.entry.startS !== null ? `+${op.entry.startS}` : ""}` : op.op));

/** Un moteur réduit à ses fins : la VRAIE file, une position réglable, ce qui est lancé ou signalé. */
function rig(options: { origin?: AudioBridgeSource["origin"]; next?: boolean } = {}) {
  const queue = new AudioQueue();
  const state = { positionS: 0, swap: false, flags: freshFlags(false) };
  const ran: QueueResult[] = [];
  const failed: string[] = [];
  let stopped = 0;
  const host: EndsHost = {
    queue,
    props: () => NO_PROPS,
    flags: () => state.flags,
    positionS: () => state.positionS,
    swapScheduled: () => state.swap,
    run: (result) => void ran.push(result),
    fail: (message) => void failed.push(message),
    stopAtEnd: () => void stopped++,
    emitState: () => undefined,
  };
  const ends = new FileEnds(host);
  queue.play(track("t1"), src("1", options.origin), null);
  if (options.next !== false) queue.setNext(track("t2"), src("2"));
  queue.startFile(1);
  /** Le titre joue jusqu'à `s` secondes. */
  const playTo = (s: number) => {
    state.positionS = s;
    ends.played();
  };
  return { queue, state, ends, ran, failed, playTo, stopped: () => stopped };
}

describe("coupure en milieu de titre — la règle (S5)", () => {
  it("une source d'extension arrêtée bien avant sa fin est une coupure ; sa vraie fin non", () => {
    const at = (positionMs: number, extra: Partial<Parameters<typeof isCut>[0]> = {}) => isCut({ origin: "plugin", durationMs: 200_000, positionMs, reloads: 0, ...extra });
    expect(at(60_000)).toBe(true);
    expect(at(200_000 - CUT_MARGIN_MS + 1)).toBe(false);
    expect(at(60_000, { origin: "library" }), "la FIN d'un fichier de la bibliothèque : jamais").toBe(false);
    expect(at(60_000, { origin: "library", error: true }), "son ERREUR de lecture en plein titre : reprise").toBe(true);
    expect(at(60_000, { durationMs: null }), "durée inconnue : on ne devine pas").toBe(false);
    expect(at(0), "rien joué : un échec de chargement, pas une coupure").toBe(false);
    expect(at(60_000, { reloads: MAX_CUT_RELOADS })).toBe(false);
  });

  it("compte par titre, dernière position jouée retenue, remise à zéro par un autre titre", () => {
    const cuts = new CutReloads();
    expect(cuts.take("t1", "plugin", 200_000), "aucune position jouée").toBeNull();
    cuts.played("t1", 61.5);
    // Au même endroit : la position, puis au-delà de la zone abîmée.
    expect([0, 1, 2].map(() => cuts.take("t1", "plugin", 200_000))).toEqual([61.5, 62.5, 68.5]);
    expect(cuts.take("t1", "plugin", 200_000), "trois relectures au plus").toBeNull();
    cuts.played("t2", 30);
    expect(cuts.take("t2", "plugin", 200_000), "un autre titre repart de zéro").toBe(30);
    cuts.reset();
    expect(cuts.take("t2", "plugin", 200_000)).toBeNull();
  });

  it("une lecture qui a nettement repris redonne ses relectures à un défaut plus loin", () => {
    const cuts = new CutReloads();
    cuts.played("t1", 20);
    cuts.take("t1", "plugin", 200_000);
    cuts.take("t1", "plugin", 200_000);
    cuts.played("t1", 21 + CUT_PROGRESS_MS / 1000);
    expect(cuts.take("t1", "plugin", 200_000)).toBe(21 + CUT_PROGRESS_MS / 1000);
  });
});

describe("coupure en milieu de titre — les fins de fichier du moteur", () => {
  it("mpv finit le fichier à 60 s d'un titre de 200 s : relu à 60 s, le suivant reste derrière (pas de saut)", () => {
    const r = rig();
    r.playTo(60);
    r.ends.endFile(1, "eof", 0);
    expect(r.ran.map((x) => shape(x.ops))).toEqual([["load:replace:1@3+60", "load:append:2@4"]]);
    expect(r.queue.current()?.track.trackKey).toBe("t1");
    // mpv avait déjà ouvert le suivant : cette entrée n'existe plus pour la file (ignorée par le moteur).
    expect(r.queue.startFile(2)).toBeNull();
    expect(r.queue.startFile(3)?.notices).toEqual([]);
  });

  it("la vraie fin, une source de la bibliothèque, une bascule en attente : mpv passe au suivant comme avant", () => {
    const real = rig();
    real.playTo(199);
    real.ends.endFile(1, "eof", 0);
    const library = rig({ origin: "library" });
    library.playTo(60);
    library.ends.endFile(1, "eof", 0);
    const swapping = rig();
    swapping.playTo(60);
    swapping.state.swap = true;
    swapping.ends.endFile(1, "eof", 0);
    expect([real.ran, library.ran, swapping.ran]).toEqual([[], [], []]);
  });

  it("trois relectures au plus pour un titre, puis la fin est tenue pour vraie", () => {
    const r = rig();
    let id = 1;
    for (let i = 0; i < MAX_CUT_RELOADS; i += 1) {
      r.playTo(60 + i);
      r.ends.endFile(id, "eof", 0);
      id = r.queue.current()?.mpvId ?? -1;
      r.queue.startFile(id);
    }
    expect(r.ran).toHaveLength(MAX_CUT_RELOADS);
    r.playTo(70);
    r.ends.endFile(id, "eof", 0);
    expect(r.ran).toHaveLength(MAX_CUT_RELOADS);
  });

  it("erreur en milieu de titre : relue ; erreur au chargement (rien joué) : signalée, la source est redemandée", () => {
    const cut = rig();
    cut.playTo(42);
    cut.ends.endFile(1, "error", -13);
    expect(shape(cut.ran[0]?.ops ?? [])[0]).toBe("load:replace:1@3+42");
    expect(cut.failed).toEqual([]);
    const library = rig({ origin: "library" });
    library.playTo(42);
    library.ends.endFile(1, "error", -13);
    expect(shape(library.ran[0]?.ops ?? [])[0], "une trame illisible d'un fichier de la bibliothèque aussi").toBe("load:replace:1@3+42");
    const load = rig();
    load.ends.endFile(1, "error", -13);
    expect(load.ran).toEqual([]);
    expect(load.failed).toEqual(["end-file -13"]);
  });

  it("dernier fichier tenu par mpv (keep-open) : coupure relue ; vraie fin : la lecture s'arrête", () => {
    const cut = rig({ next: false });
    cut.playTo(90);
    cut.ends.eof();
    expect(shape(cut.ran[0]?.ops ?? [])).toEqual(["load:replace:1@2+90"]);
    const end = rig({ next: false });
    end.playTo(199.5);
    end.state.positionS = 199.5;
    end.ends.eof();
    expect(end.ran).toEqual([]);
    expect(end.stopped()).toBe(1);
  });
});
