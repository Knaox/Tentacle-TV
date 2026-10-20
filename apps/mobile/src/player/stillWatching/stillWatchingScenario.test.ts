import { describe, expect, it } from "vitest";
import {
  initialStillWatchingSession, stillWatchingActivity, stillWatchingContinue, stillWatchingNeedsPause, stillWatchingTick,
  type StillWatchingSession, type StillWatchingSettings,
} from "@tentacle-tv/shared";
import { stillWatchingNotice } from "./backgroundNotice";
import { engineResumeIsPresence } from "./enginePresence";

/**
 * « Vous regardez encore ? » sur le mobile, de bout en bout, horloge INJECTÉE
 * et durées réduites (5 s de lecture, 3 s pour répondre — au lieu de 1 h 30 et
 * 10 s) : la règle partagée du bureau, cadencée comme le lecteur mobile la
 * cadence (un battement par seconde), avec ce que le mobile y ajoute — les
 * reprises du système qui prouvent une présence, la notification hors écran.
 */

const SETTINGS: StillWatchingSettings = { enabled: true, afterMs: 5_000, countdownMs: 3_000 };

function run(session: StillWatchingSession, from: number, seconds: number, playing = true): { session: StillWatchingSession; now: number } {
  let current = session;
  let now = from;
  for (let i = 0; i < seconds; i += 1) {
    now += 1_000;
    current = stillWatchingTick(current, { now, playing, settings: SETTINGS });
  }
  return { session: current, now };
}

describe("« Vous regardez encore ? » sur le mobile (durées réduites)", () => {
  it("sans geste : la question au bout de la durée, puis la PAUSE à la fin du décompte — comme au bureau", () => {
    let { session, now } = run(stillWatchingTick(initialStillWatchingSession(), { now: 0, playing: true, settings: SETTINGS }), 0, 5);
    expect(session.phase).toBe("asking");
    ({ session, now } = run(session, now, 3));
    expect(session.phase).toBe("paused");
    // Le lecteur doit obéir : la pause est demandée tant que la lecture tourne encore.
    expect(stillWatchingNeedsPause(session, true, now)).toBe(true);
  });

  it("un toucher (habillage, geste, barre) remet le compteur à zéro", () => {
    let { session, now } = run(stillWatchingTick(initialStillWatchingSession(), { now: 0, playing: true, settings: SETTINGS }), 0, 4);
    session = stillWatchingActivity(session, now);
    ({ session, now } = run(session, now, 4));
    expect(session.phase).toBe("watching");
    ({ session } = run(session, now, 1));
    expect(session.phase).toBe("asking");
  });

  it("une reprise venue du système (écran verrouillé, PiP, AirPlay, casque) compte comme une présence", () => {
    // L'écran tenait la pause, le moteur annonce la lecture : quelqu'un a appuyé sur Lecture.
    expect(engineResumeIsPresence(true, false)).toBe(true);
    // L'écho de ce que l'écran a demandé, ou une pause du moteur, non.
    expect(engineResumeIsPresence(false, false)).toBe(false);
    expect(engineResumeIsPresence(false, true)).toBe(false);
  });

  it("en arrière-plan et en PiP le compteur CONTINUE ; la notification dit la question puis la pause", () => {
    let { session, now } = run(stillWatchingTick(initialStillWatchingSession(), { now: 0, playing: true, settings: SETTINGS }), 0, 5);
    const asked = session.phase === "asking" ? "asking" : "none";
    expect(stillWatchingNotice(asked, "background")).toBe("ask");
    ({ session, now } = run(session, now, 3));
    expect(stillWatchingNotice(session.phase === "paused" ? "paused" : "none", "background")).toBe("paused");
    // De retour dans l'app : plus de notification, l'encart le dit.
    expect(stillWatchingNotice("paused", "active")).toBeNull();
    // « Reprendre » : compteur à zéro.
    session = stillWatchingContinue(now);
    expect(session.phase).toBe("watching");
    expect(session.watchedMs).toBe(0);
  });

  it("une pause ou un chargement ne comptent pas comme de la lecture", () => {
    const { session } = run(stillWatchingTick(initialStillWatchingSession(), { now: 0, playing: true, settings: SETTINGS }), 0, 10, false);
    expect(session.phase).toBe("watching");
    expect(session.watchedMs).toBe(0);
  });
});
