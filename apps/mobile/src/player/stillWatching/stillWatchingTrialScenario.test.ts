import { describe, expect, it } from "vitest";
import {
  armStillWatchingTrial, DEFAULT_STILL_WATCHING_SETTINGS, initialStillWatchingSession, stillWatchingNeedsPause,
  stillWatchingTick, withStillWatchingTrial, type StillWatchingSession, type StillWatchingSettings,
} from "@tentacle-tv/shared";

/**
 * « Essayer », dans Réglages › Lecture du mobile (`StillWatchingTrialRow`) :
 * avec les VRAIES durées du compte (1 h 30, 10 s), la question paraît après
 * vingt secondes de lecture sans geste, puis la lecture se met en PAUSE au
 * bout du décompte réglé. Coupé, rien — essai ou non.
 */

const TRIAL = armStillWatchingTrial(0);

function play(settings: StillWatchingSettings, seconds: number): { session: StillWatchingSession; now: number } {
  let session = stillWatchingTick(initialStillWatchingSession(), { now: 0, playing: true, settings: withStillWatchingTrial(settings, TRIAL, 0) });
  let now = 0;
  for (let i = 0; i < seconds; i += 1) {
    now += 1_000;
    session = stillWatchingTick(session, { now, playing: true, settings: withStillWatchingTrial(settings, TRIAL, now) });
  }
  return { session, now };
}

describe("« Essayer » sur le mobile, aux durées réelles du compte", () => {
  it("la question après vingt secondes sans geste, puis la pause dix secondes plus tard", () => {
    expect(play(DEFAULT_STILL_WATCHING_SETTINGS, 19).session.phase).toBe("watching");
    expect(play(DEFAULT_STILL_WATCHING_SETTINGS, 20).session.phase).toBe("asking");
    const { session, now } = play(DEFAULT_STILL_WATCHING_SETTINGS, 30);
    expect(session.phase).toBe("paused");
    // Une pause, pas un arrêt : le lecteur est mis en pause, la position reste.
    expect(stillWatchingNeedsPause(session, true, now)).toBe(true);
  });

  it("réglage coupé : jamais de question, même avec un essai armé", () => {
    const off = { ...DEFAULT_STILL_WATCHING_SETTINGS, enabled: false };
    expect(play(off, 120).session.phase).toBe("watching");
  });
});
