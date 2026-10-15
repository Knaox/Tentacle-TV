import { describe, expect, it } from "vitest";
import {
  initialStillWatchingSession,
  stillWatchingActivity,
  stillWatchingContinue,
  stillWatchingNeedsPause,
  stillWatchingPauseNow,
  stillWatchingRemainingMs,
  stillWatchingTick,
  STILL_WATCHING_PAUSE_GRACE_MS,
  type StillWatchingSession,
} from "./stillWatchingSession";
import { DEFAULT_STILL_WATCHING_SETTINGS, normalizeStillWatchingSettings, type StillWatchingSettings } from "./stillWatchingSettings";

const settings: StillWatchingSettings = { enabled: true, afterMs: 10_000, countdownMs: 4_000 };

/** Fait tourner le minuteur de seconde en seconde. */
function run(session: StillWatchingSession, from: number, to: number, playing = true, s = settings): StillWatchingSession {
  let current = session;
  for (let now = from; now <= to; now += 1_000) current = stillWatchingTick(current, { now, playing, settings: s });
  return current;
}

describe("« Vous regardez encore ? » — le minuteur", () => {
  it("demande après le temps de lecture sans geste, puis met en pause à la fin du décompte", () => {
    let session = run(initialStillWatchingSession(), 0, 9_000);
    expect(session.phase).toBe("watching");
    session = run(session, 10_000, 10_000);
    expect(session.phase).toBe("asking");
    expect(stillWatchingRemainingMs(session, 12_000, settings)).toBe(2_000);
    session = run(session, 11_000, 14_000);
    expect(session.phase).toBe("paused");
    expect(stillWatchingNeedsPause(session, true, 14_500)).toBe(true);
  });

  it("ne compte pas une pause ni un sommeil de l'appareil", () => {
    let session = run(initialStillWatchingSession(), 0, 5_000);
    session = run(session, 6_000, 60_000, false);
    expect(session.watchedMs).toBe(5_000);
    // Un trou d'une heure entre deux ticks ne vaut que le plafond.
    session = stillWatchingTick(session, { now: 61_000, playing: true, settings });
    session = stillWatchingTick(session, { now: 3_661_000, playing: true, settings });
    expect(session.watchedMs).toBe(10_000);
  });

  it("un geste remet le compteur à zéro, et répond à la question", () => {
    let session = run(initialStillWatchingSession(), 0, 8_000);
    session = stillWatchingActivity(session, 8_500);
    expect(session.watchedMs).toBe(0);
    session = run(session, 9_000, 20_000);
    expect(session.phase).toBe("asking");
    expect(stillWatchingActivity(session, 20_500).phase).toBe("watching");
  });

  it("en pause, un geste ne ferme rien : seule la reprise de la lecture en sort", () => {
    let session = run(initialStillWatchingSession(), 0, 14_000);
    expect(session.phase).toBe("paused");
    expect(stillWatchingActivity(session, 15_000)).toBe(session);
    // La lecture tourne encore pendant la grâce : c'est le lecteur qui n'a pas encore obéi.
    const pausedAt = session.pausedAt as number;
    expect(stillWatchingTick(session, { now: pausedAt + 1_000, playing: true, settings }).phase).toBe("paused");
    // Après la grâce, une lecture qui tourne est une reprise voulue.
    const resumed = stillWatchingTick(session, { now: pausedAt + STILL_WATCHING_PAUSE_GRACE_MS, playing: true, settings });
    expect(resumed.phase).toBe("watching");
    expect(stillWatchingNeedsPause(session, true, pausedAt + STILL_WATCHING_PAUSE_GRACE_MS)).toBe(false);
    expect(stillWatchingContinue(30_000)).toEqual({ ...initialStillWatchingSession(), lastTickAt: 30_000 });
  });

  it("« Mettre en pause » pendant la question passe en pause tout de suite", () => {
    const asking = run(initialStillWatchingSession(), 0, 10_000);
    const paused = stillWatchingPauseNow(asking, 11_000);
    expect(paused.phase).toBe("paused");
    expect(stillWatchingNeedsPause(paused, true, 11_500)).toBe(true);
    expect(stillWatchingPauseNow(initialStillWatchingSession(), 1).phase).toBe("watching");
  });

  it("coupé, il ne demande jamais rien", () => {
    const session = run(initialStillWatchingSession(), 0, 60_000, true, { ...settings, enabled: false });
    expect(session.phase).toBe("watching");
    expect(session.watchedMs).toBe(0);
  });

  it("rend la même session quand rien ne change", () => {
    const session = initialStillWatchingSession();
    expect(stillWatchingTick(session, { now: 1, playing: false, settings })).toBe(session);
    expect(stillWatchingActivity(session, 1)).toBe(session);
  });
});

describe("« Vous regardez encore ? » — le réglage", () => {
  it("activé par défaut, une heure et demie, dix secondes", () => {
    expect(normalizeStillWatchingSettings(undefined)).toEqual(DEFAULT_STILL_WATCHING_SETTINGS);
    expect(DEFAULT_STILL_WATCHING_SETTINGS).toEqual({ enabled: true, afterMs: 5_400_000, countdownMs: 10_000 });
  });

  it("borne les valeurs farfelues", () => {
    expect(normalizeStillWatchingSettings({ enabled: "oui", afterMs: 1, countdownMs: 1e9 })).toEqual({
      enabled: true,
      afterMs: 15 * 60_000,
      countdownMs: 120_000,
    });
  });
});
