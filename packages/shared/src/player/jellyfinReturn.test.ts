import { describe, expect, it } from "vitest";
import {
  decideJellyfinReturn, mpvStreamLost, returnStallDeadline, RETURN_STALL_MS, RETURN_WATCH_MS, withinReturnWatch,
} from "./jellyfinReturn";

describe("le retour de Jellyfin", () => {
  it("une lecture qui a tenu sur sa réserve continue, sans rien recharger", () => {
    expect(decideJellyfinReturn({ started: true, failedDuringOutage: false })).toBe("resume");
  });

  it("le flux se rouvre si la lecture n'avait pas démarré, ou s'il est mort pendant la panne", () => {
    expect(decideJellyfinReturn({ started: false, failedDuringOutage: false })).toBe("reopen");
    expect(decideJellyfinReturn({ started: true, failedDuringOutage: true })).toBe("reopen");
  });

  it("la fenêtre d'après-retour dure RETURN_WATCH_MS", () => {
    expect(withinReturnWatch(1000, null)).toBe(false);
    expect(withinReturnWatch(1000 + RETURN_WATCH_MS - 1, 1000)).toBe(true);
    expect(withinReturnWatch(1000 + RETURN_WATCH_MS, 1000)).toBe(false);
  });

  it("une image arrêtée laisse au lecteur RETURN_STALL_MS pour se reconnecter seul", () => {
    // Arrêtée après le retour : depuis l'arrêt.
    expect(returnStallDeadline({ now: 0, returnedAt: 1000, stalledSince: 4000, reopened: false })).toBe(4000 + RETURN_STALL_MS);
    // Arrêtée PENDANT la panne : depuis le retour.
    expect(returnStallDeadline({ now: 0, returnedAt: 1000, stalledSince: 200, reopened: false })).toBe(1000 + RETURN_STALL_MS);
  });

  it("jamais deux réouvertures pour un retour, jamais hors fenêtre, jamais sans arrêt", () => {
    expect(returnStallDeadline({ now: 0, returnedAt: 1000, stalledSince: 2000, reopened: true })).toBeNull();
    expect(returnStallDeadline({ now: 0, returnedAt: 1000, stalledSince: null, reopened: false })).toBeNull();
    expect(returnStallDeadline({ now: 0, returnedAt: null, stalledSince: 2000, reopened: false })).toBeNull();
    expect(returnStallDeadline({ now: 0, returnedAt: 1000, stalledSince: 1000 + RETURN_WATCH_MS, reopened: false })).toBeNull();
  });

  it("un moteur qui a perdu son flux sans erreur se rouvre", () => {
    expect(decideJellyfinReturn({ started: true, failedDuringOutage: false, streamLost: true })).toBe("reopen");
    expect(decideJellyfinReturn({ started: true, failedDuringOutage: false, streamLost: false })).toBe("resume");
  });

  it("mpv : un transcodage est toujours réputé perdu (segments sautés pendant la panne, mesuré)", () => {
    expect(mpvStreamLost({ transcoding: true, cacheEof: true, cacheEndS: 488, durationS: 600 })).toBe(true);
    expect(mpvStreamLost({ transcoding: true, cacheEof: false, cacheEndS: 300, durationS: 600 })).toBe(true);
    expect(mpvStreamLost({ transcoding: true, cacheEof: null, cacheEndS: null, durationS: null })).toBe(true);
  });

  it("mpv en lecture directe : perdu seulement si le flux s'est fini AVANT la fin", () => {
    expect(mpvStreamLost({ transcoding: false, cacheEof: true, cacheEndS: 300, durationS: 600 })).toBe(true);
    // Tout le fichier en cache (mesuré : 545 s d'avance) : la vraie fin, gardée.
    expect(mpvStreamLost({ transcoding: false, cacheEof: true, cacheEndS: 599.9, durationS: 600 })).toBe(false);
    expect(mpvStreamLost({ transcoding: false, cacheEof: false, cacheEndS: 300, durationS: 600 })).toBe(false);
    expect(mpvStreamLost({ transcoding: false, cacheEof: null, cacheEndS: null, durationS: null })).toBe(false);
  });
});
