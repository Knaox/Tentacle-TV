import { describe, expect, it } from "vitest";
import { DEFAULT_STILL_WATCHING_SETTINGS } from "./stillWatchingSettings";
import { initialStillWatchingSession, stillWatchingTick } from "./stillWatchingSession";
import {
  STILL_WATCHING_TRIAL_AFTER_MS,
  STILL_WATCHING_TRIAL_TTL_MS,
  armStillWatchingTrial,
  stillWatchingTrialLive,
  stillWatchingTrialRemainingMs,
  withStillWatchingTrial,
} from "./stillWatchingTrial";

const T0 = 1_000_000;

describe("l'essai de « Vous regardez encore ? »", () => {
  it("avance la question à vingt secondes, garde le décompte du réglage", () => {
    const trial = armStillWatchingTrial(T0);
    const settings = { ...DEFAULT_STILL_WATCHING_SETTINGS, countdownMs: 30_000 };
    expect(withStillWatchingTrial(settings, trial, T0 + 5_000)).toEqual({
      enabled: true,
      afterMs: STILL_WATCHING_TRIAL_AFTER_MS,
      countdownMs: 30_000,
    });
  });

  it("hors essai, rend le réglage tel quel (même objet)", () => {
    const settings = DEFAULT_STILL_WATCHING_SETTINGS;
    expect(withStillWatchingTrial(settings, null, T0)).toBe(settings);
  });

  it("ne rallume pas une question coupée", () => {
    const settings = { ...DEFAULT_STILL_WATCHING_SETTINGS, enabled: false };
    expect(withStillWatchingTrial(settings, armStillWatchingTrial(T0), T0)).toBe(settings);
  });

  it("s'éteint seul, oublié, au bout de dix minutes", () => {
    const trial = armStillWatchingTrial(T0);
    expect(stillWatchingTrialLive(trial, T0 + STILL_WATCHING_TRIAL_TTL_MS - 1)).toBe(true);
    expect(stillWatchingTrialLive(trial, T0 + STILL_WATCHING_TRIAL_TTL_MS)).toBe(false);
    expect(stillWatchingTrialRemainingMs(trial, T0 + 60_000)).toBe(STILL_WATCHING_TRIAL_TTL_MS - 60_000);
    expect(stillWatchingTrialRemainingMs(trial, T0 + STILL_WATCHING_TRIAL_TTL_MS)).toBe(0);
  });

  it("une horloge qui recule ne le prolonge pas", () => {
    expect(stillWatchingTrialLive(armStillWatchingTrial(T0), T0 - 1)).toBe(false);
  });

  it("le minuteur réel pose la question après vingt secondes de lecture", () => {
    const trial = armStillWatchingTrial(T0);
    let session = initialStillWatchingSession();
    let now = T0;
    for (let i = 0; i <= 19; i += 1) {
      session = stillWatchingTick(session, { now, playing: true, settings: withStillWatchingTrial(DEFAULT_STILL_WATCHING_SETTINGS, trial, now) });
      now += 1_000;
    }
    expect(session.phase).toBe("watching");
    session = stillWatchingTick(session, { now, playing: true, settings: withStillWatchingTrial(DEFAULT_STILL_WATCHING_SETTINGS, trial, now) });
    expect(session.phase).toBe("asking");
  });
});
