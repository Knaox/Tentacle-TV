import { describe, expect, it } from "vitest";
import { NO_PROGRESS_MS } from "./playbackRecovery";
import { decideStartupWait, STARTUP_HINT_AFTER_MS, STARTUP_PROBE_EVERY_MS, type StartupWaitInput } from "./startupWait";

const T = 1_000_000;
const MB = 1_000_000;

/** Un transcodage émis depuis `ms`, rien de prêt, aucune sonde. */
function opening(ms: number, over: Partial<StartupWaitInput> = {}): StartupWaitInput {
  return {
    now: T, transcoding: true, emittedAt: T - ms, lastProgressAt: null, failed: false,
    source: "unknown", sourceCheckedAt: null, probing: false, measuredBps: null, neededBps: null,
    ...over,
  };
}

describe("decideStartupWait — l'ouverture d'un transcodage", () => {
  it("une ouverture ordinaire ne dit rien", () => {
    expect(decideStartupWait(opening(STARTUP_HINT_AFTER_MS - 1))).toEqual({ hint: null, probe: false, fail: false });
  });

  it("au-delà : la ligne discrète, et une sonde du chemin du flux", () => {
    expect(decideStartupWait(opening(STARTUP_HINT_AFTER_MS))).toEqual({ hint: { kind: "transcoding" }, probe: true, fail: false });
  });

  it("hors transcodage, sans flux, ou déjà en échec : rien (l'ouverture actuelle s'en charge)", () => {
    expect(decideStartupWait(opening(60_000, { transcoding: false }))).toEqual({ hint: null, probe: false, fail: false });
    expect(decideStartupWait(opening(60_000, { emittedAt: null }))).toEqual({ hint: null, probe: false, fail: false });
    expect(decideStartupWait(opening(60_000, { failed: true }))).toEqual({ hint: null, probe: false, fail: false });
  });

  it("des sondes espacées, jamais deux à la fois, et jamais celle d'avant ce flux", () => {
    const at = (checkedAgo: number) => opening(60_000, { source: "ok", sourceCheckedAt: T - checkedAgo });
    expect(decideStartupWait(at(STARTUP_PROBE_EVERY_MS - 1)).probe).toBe(false);
    expect(decideStartupWait(at(STARTUP_PROBE_EVERY_MS)).probe).toBe(true);
    expect(decideStartupWait(at(70_000)).probe).toBe(true);
    expect(decideStartupWait(opening(60_000, { probing: true })).probe).toBe(false);
  });

  it("le chemin du flux vu à terre pendant l'ouverture : l'échec tout de suite (la reprise d'ouverture dit qui manque)", () => {
    expect(decideStartupWait(opening(20_000, { source: "down", sourceCheckedAt: T - 100 })).fail).toBe(true);
    // Une panne vue AVANT ce flux ne compte pas : on resonde.
    expect(decideStartupWait(opening(20_000, { source: "down", sourceCheckedAt: T - 30_000 }))).toMatchObject({ fail: false, probe: true });
  });

  it("deux minutes sans rien : l'échec et « Réessayer »", () => {
    expect(decideStartupWait(opening(NO_PROGRESS_MS - 1)).fail).toBe(false);
    expect(decideStartupWait(opening(NO_PROGRESS_MS))).toEqual({ hint: null, probe: false, fail: true });
  });

  it("le lecteur prêt, la mémoire qui grossit : l'échéance repart", () => {
    const d = decideStartupWait(opening(NO_PROGRESS_MS + 60_000, { lastProgressAt: T - 20_000 }));
    expect(d).toMatchObject({ hint: { kind: "transcoding" }, fail: false });
  });

  it("le réseau MESURÉ sous le palier : c'est lui qu'on nomme", () => {
    expect(decideStartupWait(opening(10_000, { measuredBps: 2 * MB, neededBps: 4.5 * MB })).hint).toEqual({
      kind: "slowNetwork", network: { measuredBps: 2 * MB, neededBps: 4.5 * MB },
    });
  });
});
