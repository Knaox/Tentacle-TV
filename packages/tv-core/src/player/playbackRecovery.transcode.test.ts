import { describe, expect, it } from "vitest";
import { networkShortfall } from "./networkShortfall";
import {
  decideRecovery, NO_PROGRESS_MS, SLOW_RESTART_AFTER_MS, STALL_GRACE_MS, type RecoveryInput,
} from "./playbackRecovery";

const T = 1_000_000;
const MB = 1_000_000;

/** Un transcodage arrêté depuis `ms`, chemin du flux joignable et sondé depuis. */
function transcodeStalled(ms: number, over: Partial<RecoveryInput> = {}): RecoveryInput {
  return {
    now: T, started: true, paused: false, ended: false,
    stalledSince: T - ms, lostSince: null, openSince: null, ahead: 0, starvingSince: null,
    tentacle: "ok", source: "ok", sourceCulprit: null, sourceCheckedAt: T - ms + STALL_GRACE_MS + 100, probing: false,
    downSince: null, downWhat: null,
    restarting: false, lastRestartAt: null, vainRestarts: 0,
    transcoding: true, lastProgressAt: T - ms, measuredBps: null, neededBps: null, retryAsked: false,
    ...over,
  };
}

describe("networkShortfall — le réseau n'est accusé que mesuré", () => {
  it("mesure sous le besoin : l'écart", () => {
    expect(networkShortfall(3 * MB, 8 * MB)).toEqual({ measuredBps: 3 * MB, neededBps: 8 * MB });
  });

  it("mesure égale ou au-dessus, absente, ou besoin inconnu : rien", () => {
    expect(networkShortfall(8 * MB, 8 * MB)).toBeNull();
    expect(networkShortfall(40 * MB, 8 * MB)).toBeNull();
    expect(networkShortfall(null, 8 * MB)).toBeNull();
    expect(networkShortfall(3 * MB, null)).toBeNull();
    expect(networkShortfall(0, 8 * MB)).toBeNull();
  });
});

describe("decideRecovery — un transcodage qui se fait attendre", () => {
  it("avant la sonde : rien de bloquant, pas « la connexion est perdue » — on sonde", () => {
    const d = decideRecovery(transcodeStalled(STALL_GRACE_MS, { source: "unknown", sourceCheckedAt: null }));
    expect(d).toEqual({ phase: { kind: "transcoding", since: T - STALL_GRACE_MS }, probe: true, restart: false });
  });

  it("serveur joignable, réseau non accusé : la patience, jamais de relance", () => {
    for (const ms of [STALL_GRACE_MS, SLOW_RESTART_AFTER_MS, 60_000, NO_PROGRESS_MS - 1]) {
      expect(decideRecovery(transcodeStalled(ms))).toEqual({
        phase: { kind: "transcoding", since: T - ms }, probe: false, restart: false,
      });
    }
  });

  it("deux minutes sans AUCUNE progression : la main à l'utilisateur, sans relance", () => {
    expect(decideRecovery(transcodeStalled(NO_PROGRESS_MS))).toEqual({
      phase: { kind: "stuck", cause: "transcode", since: T - NO_PROGRESS_MS }, probe: false, restart: false,
    });
  });

  it("la mémoire qui grossit pendant l'attente repousse l'échéance", () => {
    const d = decideRecovery(transcodeStalled(200_000, { lastProgressAt: T - 30_000 }));
    expect(d.phase).toEqual({ kind: "transcoding", since: T - 200_000 });
  });

  it("une progression d'AVANT l'arrêt ne compte pas : l'échéance part de l'arrêt", () => {
    expect(decideRecovery(transcodeStalled(NO_PROGRESS_MS - 1, { lastProgressAt: T - 600_000 })).phase.kind).toBe("transcoding");
    expect(decideRecovery(transcodeStalled(NO_PROGRESS_MS, { lastProgressAt: T - 600_000 })).phase.kind).toBe("stuck");
  });

  it("le réseau MESURÉ sous le palier : « trop lent », chiffres à l'appui, sans relance", () => {
    const d = decideRecovery(transcodeStalled(30_000, { measuredBps: 3 * MB, neededBps: 8 * MB }));
    expect(d).toEqual({
      phase: { kind: "waiting", cause: "slow", since: T - 30_000, network: { measuredBps: 3 * MB, neededBps: 8 * MB } },
      probe: false, restart: false,
    });
  });

  it("le réseau mesuré assez large : ce n'est pas lui", () => {
    expect(decideRecovery(transcodeStalled(30_000, { measuredBps: 90 * MB, neededBps: 8 * MB })).phase.kind).toBe("transcoding");
  });

  it("« Réessayer » : la relance, à la sonde qui dit le serveur joignable", () => {
    const asked = transcodeStalled(NO_PROGRESS_MS + 5000, { retryAsked: true });
    expect(decideRecovery({ ...asked, sourceCheckedAt: null })).toMatchObject({
      phase: { kind: "waiting", cause: "transcode" }, probe: true, restart: false,
    });
    expect(decideRecovery(asked)).toMatchObject({ phase: { kind: "waiting", cause: "transcode" }, restart: true });
  });

  it("la source perdue (erreur du lecteur) n'est pas de la patience : relance immédiate", () => {
    const d = decideRecovery(transcodeStalled(5000, { lostSince: T - 500, sourceCheckedAt: T - 100 }));
    expect(d).toMatchObject({ phase: { kind: "waiting", cause: "network" }, restart: true });
  });

  it("Jellyfin à terre puis de retour : l'attente, puis la relance, comme ailleurs", () => {
    const down = transcodeStalled(30_000, { source: "down", sourceCulprit: "media", downSince: T - 30_000, downWhat: "media", sourceCheckedAt: T - 1000 });
    expect(decideRecovery(down).phase).toMatchObject({ kind: "waiting", cause: "media" });
    const back = { ...down, source: "ok" as const, sourceCheckedAt: T - 10 };
    expect(decideRecovery(back)).toMatchObject({ phase: { kind: "waiting", cause: "media" }, restart: true });
  });
});

describe("decideRecovery — hors transcodage, le réseau n'est accusé que mesuré", () => {
  const direct = (ms: number, over: Partial<RecoveryInput> = {}) => transcodeStalled(ms, { transcoding: false, ...over });

  it("un arrêt sans mesure : « la vidéo se fait attendre », la relance ensuite (inchangé)", () => {
    expect(decideRecovery(direct(SLOW_RESTART_AFTER_MS))).toMatchObject({ phase: { kind: "waiting", cause: "stall" }, restart: true });
  });

  it("le réseau mesuré sous le débit du fichier : « trop lent », et aucune relance n'y changerait rien", () => {
    const d = decideRecovery(direct(60_000, { measuredBps: 12 * MB, neededBps: 40 * MB }));
    expect(d).toMatchObject({ phase: { kind: "waiting", cause: "slow", network: { measuredBps: 12 * MB } }, restart: false });
  });

  it("« Réessayer » relance même un réseau trop lent", () => {
    expect(decideRecovery(direct(60_000, { measuredBps: 12 * MB, neededBps: 40 * MB, retryAsked: true })).restart).toBe(true);
  });
});
