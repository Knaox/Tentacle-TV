/**
 * Le retour d'une commande : envoi, attente de l'appareil, verdict — et la
 * fin de chaque affichage.
 */

import { describe, expect, it } from "vitest";
import {
  LATE_AFTER_MS, LATE_VISIBLE_MS, SENDING_TIMEOUT_MS, VERDICT_VISIBLE_MS,
  accepted, buttonStatus, isApplied, settle, settleAll, type Feedback,
} from "./commandFeedback";

const playing = { playing: true, isPaused: false };
const paused = { playing: true, isPaused: true };
const stopped = { playing: false, isPaused: false };

describe("isApplied", () => {
  it("pause, reprise et arrêt se constatent sur l'instantané", () => {
    expect(isApplied("Pause", paused)).toBe(true);
    expect(isApplied("Pause", playing)).toBe(false);
    expect(isApplied("Unpause", playing)).toBe(true);
    expect(isApplied("Stop", stopped)).toBe(true);
    expect(isApplied("Stop", undefined)).toBe(true);
    expect(isApplied("Stop", paused)).toBe(false);
    // Une session disparue n'a pas « mis en pause ».
    expect(isApplied("Pause", undefined)).toBe(false);
  });
});

describe("settle", () => {
  const waiting: Feedback = { command: "Pause", phase: "waiting", at: 0 };

  it("l'envoi attend la réponse de Jellyfin, quoi que dise l'instantané — pas indéfiniment", () => {
    const sending: Feedback = { command: "Pause", phase: "sending", at: 0 };
    expect(settle(sending, paused, SENDING_TIMEOUT_MS - 1)).toBe(sending);
    expect(settle(sending, paused, SENDING_TIMEOUT_MS)).toEqual({ command: "Pause", phase: "failed", at: SENDING_TIMEOUT_MS });
  });

  it("accepté : un message est rendu, une commande attend l'appareil", () => {
    expect(accepted({ command: "message", phase: "sending", at: 0 }, 5).phase).toBe("done");
    expect(accepted({ command: "Stop", phase: "sending", at: 0 }, 5)).toEqual({ command: "Stop", phase: "waiting", at: 5 });
  });

  it("l'effet constaté clôt l'attente", () => {
    expect(settle(waiting, paused, 1_000)).toEqual({ command: "Pause", phase: "done", at: 1_000 });
    expect(settle(waiting, playing, 1_000)).toBe(waiting);
  });

  it("trop long : l'appareil n'a pas encore réagi — puis la carte revient à son état", () => {
    const late = settle(waiting, playing, LATE_AFTER_MS);
    expect(late).toEqual({ command: "Pause", phase: "late", at: LATE_AFTER_MS });
    expect(settle(late!, playing, LATE_AFTER_MS + LATE_VISIBLE_MS - 1)).toBe(late);
    expect(settle(late!, playing, LATE_AFTER_MS + LATE_VISIBLE_MS)).toBeNull();
    // Un effet qui arrive en retard compte encore.
    expect(settle(late!, paused, LATE_AFTER_MS + 1)?.phase).toBe("done");
  });

  it("succès et échec s'effacent après leur temps d'affichage", () => {
    const done: Feedback = { command: "Pause", phase: "done", at: 0 };
    expect(settle(done, paused, VERDICT_VISIBLE_MS - 1)).toBe(done);
    expect(settle(done, paused, VERDICT_VISIBLE_MS)).toBeNull();
  });
});

describe("settleAll", () => {
  it("annonce l'arrêt constaté, garde la référence quand rien ne bouge", () => {
    const entries = new Map<string, Feedback>([
      ["a", { command: "Stop", phase: "waiting", at: 0 }],
      ["b", { command: "Pause", phase: "waiting", at: 0 }],
    ]);
    const first = settleAll(entries, new Map([["b", playing]]), 1_000);
    expect(first.confirmed).toEqual([{ id: "a", command: "Stop" }]);
    expect(first.entries.get("a")?.phase).toBe("done");

    const quiet = new Map<string, Feedback>([["b", { command: "Pause", phase: "waiting", at: 0 }]]);
    const again = settleAll(quiet, new Map([["b", playing]]), 1_000);
    expect(again.unchanged).toBe(true);
    expect(again.entries).toBe(quiet);
  });
});

describe("buttonStatus", () => {
  it("occupé pendant l'envoi et l'attente, libre dès que l'appareil tarde", () => {
    const f = (phase: Feedback["phase"], command: Feedback["command"] = "Pause"): Feedback => ({ command, phase, at: 0 });
    expect(buttonStatus(f("sending"), ["Pause", "Unpause"])).toBe("busy");
    expect(buttonStatus(f("waiting"), ["Pause", "Unpause"])).toBe("busy");
    expect(buttonStatus(f("late"), ["Pause", "Unpause"])).toBe("idle");
    expect(buttonStatus(f("failed"), ["Pause", "Unpause"])).toBe("error");
    expect(buttonStatus(f("done"), ["Pause", "Unpause"])).toBe("idle");
    expect(buttonStatus(f("done", "message"), ["message"])).toBe("done");
    // Une commande sur un AUTRE bouton ne le touche pas.
    expect(buttonStatus(f("sending", "Stop"), ["Pause", "Unpause"])).toBe("idle");
    expect(buttonStatus(undefined, ["Stop"])).toBe("idle");
  });
});
