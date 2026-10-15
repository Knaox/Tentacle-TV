import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_STILL_WATCHING_SETTINGS,
  STILL_WATCHING_TRIAL_AFTER_MS,
  STILL_WATCHING_TRIAL_TTL_MS,
  initialStillWatchingSession,
  type StillWatchingSession,
} from "@tentacle-tv/shared";
import {
  armStillWatchingTrialNow,
  cancelStillWatchingTrial,
  readStillWatchingTrial,
  resetStillWatchingTrial,
  stillWatchingTrialSource,
  tickWithStillWatchingTrial,
} from "./stillWatchingTrialStore";

const T0 = Date.UTC(2026, 9, 15, 20, 0, 0);
const settings = { ...DEFAULT_STILL_WATCHING_SETTINGS, countdownMs: 10_000 };

/** Le minuteur réel, une seconde par battement, comme `useStillWatching`. */
function play(session: StillWatchingSession, seconds: number, playing = true): StillWatchingSession {
  let current = session;
  for (let i = 0; i < seconds; i += 1) {
    vi.advanceTimersByTime(1_000);
    current = tickWithStillWatchingTrial(current, { now: Date.now(), playing, settings });
  }
  return current;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  resetStillWatchingTrial();
});

afterEach(() => {
  resetStillWatchingTrial();
  vi.useRealTimers();
});

describe("le magasin de l'essai", () => {
  it("armé, il attend la lecture ; les Réglages sont prévenus", () => {
    const listener = vi.fn();
    const unsubscribe = stillWatchingTrialSource.subscribe(listener);
    armStillWatchingTrialNow();
    expect(stillWatchingTrialSource.readArmed()).toBe(true);
    expect(readStillWatchingTrial()).toEqual({ armedAt: T0 });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("oublié, il s'éteint seul et le dit", () => {
    const listener = vi.fn();
    const unsubscribe = stillWatchingTrialSource.subscribe(listener);
    armStillWatchingTrialNow();
    vi.advanceTimersByTime(STILL_WATCHING_TRIAL_TTL_MS - 1);
    expect(stillWatchingTrialSource.readArmed()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(stillWatchingTrialSource.readArmed()).toBe(false);
    expect(readStillWatchingTrial()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("réarmé, il repart de zéro", () => {
    armStillWatchingTrialNow();
    vi.advanceTimersByTime(STILL_WATCHING_TRIAL_TTL_MS - 1_000);
    armStillWatchingTrialNow();
    vi.advanceTimersByTime(5_000);
    expect(stillWatchingTrialSource.readArmed()).toBe(true);
  });

  it("annulé, plus rien", () => {
    armStillWatchingTrialNow();
    cancelStillWatchingTrial();
    expect(readStillWatchingTrial()).toBeNull();
  });
});

describe("le minuteur pendant l'essai", () => {
  it("pose la question après vingt secondes de lecture, puis consomme l'essai", () => {
    armStillWatchingTrialNow();
    let session = play(initialStillWatchingSession(), STILL_WATCHING_TRIAL_AFTER_MS / 1_000);
    expect(session.phase).toBe("watching");
    session = play(session, 1);
    expect(session.phase).toBe("asking");
    expect(stillWatchingTrialSource.readArmed()).toBe(false);
  });

  it("le décompte et la pause à l'expiration sont ceux du réglage", () => {
    armStillWatchingTrialNow();
    let session = play(initialStillWatchingSession(), 21);
    expect(session.phase).toBe("asking");
    session = play(session, 9);
    expect(session.phase).toBe("asking");
    session = play(session, 1);
    expect(session.phase).toBe("paused");
  });

  it("une lecture en pause ne compte pas : l'essai attend", () => {
    armStillWatchingTrialNow();
    const session = play(initialStillWatchingSession(), 60, false);
    expect(session.phase).toBe("watching");
    expect(stillWatchingTrialSource.readArmed()).toBe(true);
  });

  it("consommé, le minuteur revient au réglage du compte", () => {
    armStillWatchingTrialNow();
    let session = play(initialStillWatchingSession(), 21);
    expect(session.phase).toBe("asking");
    // « Continuer » : le compteur repart, sans essai cette fois.
    session = { ...initialStillWatchingSession(), lastTickAt: Date.now() };
    session = play(session, 120);
    expect(session.phase).toBe("watching");
  });

  it("sans essai, rien ne change", () => {
    const session = play(initialStillWatchingSession(), 120);
    expect(session.phase).toBe("watching");
  });

  it("un réglage coupé ne pose aucune question, et l'essai reste en attente", () => {
    armStillWatchingTrialNow();
    let session = initialStillWatchingSession();
    for (let i = 0; i < 30; i += 1) {
      vi.advanceTimersByTime(1_000);
      session = tickWithStillWatchingTrial(session, { now: Date.now(), playing: true, settings: { ...settings, enabled: false } });
    }
    expect(session.phase).toBe("watching");
    expect(stillWatchingTrialSource.readArmed()).toBe(true);
  });
});
