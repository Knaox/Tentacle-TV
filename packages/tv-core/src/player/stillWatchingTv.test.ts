import { describe, expect, it } from "vitest";
import { resolveBack } from "../nav/backResolve";
import type { RemoteIntent } from "../remote/intents";
import { playerBackLayers } from "./playerBack";
import { playerFocusClaims, preferredFocusOf } from "./playerFocus";
import { playerBackgroundFocus, playerChromeVisibility, type PlayerChromeState } from "./playerStage";
import { STILL_WATCHING_TV_KEYS, stillWatchingFocusEntry, stillWatchingRemoteAnswer } from "./stillWatchingTv";

const RIGHT: RemoteIntent = { type: "move", direction: "droite" };
const UP: RemoteIntent = { type: "move", direction: "haut" };
const OK: RemoteIntent = { type: "select" };
const PLAY_PAUSE: RemoteIntent = { type: "playPause" };
const PLAY: RemoteIntent = { type: "transport", command: "lecture" };
const PAUSE: RemoteIntent = { type: "transport", command: "pause" };
const BACK: RemoteIntent = { type: "retour" };
const SWIPE: RemoteIntent = { type: "swipe", direction: "gauche" };

describe("« Vous regardez encore ? » à la télécommande", () => {
  it("en lecture, tout appui prouve une présence", () => {
    for (const intent of [RIGHT, UP, OK, PLAY_PAUSE, PLAY, PAUSE, BACK, SWIPE]) {
      expect(stillWatchingRemoteAnswer("none", intent)).toBe("activity");
    }
  });

  it("pendant la question, viser un bouton n'est pas une réponse : seul OK sur le bouton répond", () => {
    for (const intent of [RIGHT, UP, OK, BACK, SWIPE]) expect(stillWatchingRemoteAnswer("asking", intent)).toBeNull();
  });

  it("pendant la question, Lecture/Pause et Pause mettent en pause, Lecture répond « Continuer »", () => {
    expect(stillWatchingRemoteAnswer("asking", PLAY_PAUSE)).toBe("pauseNow");
    expect(stillWatchingRemoteAnswer("asking", PAUSE)).toBe("pauseNow");
    expect(stillWatchingRemoteAnswer("asking", PLAY)).toBe("keepWatching");
  });

  it("en pause, seule une touche de lecture reprend ; Pause et le reste n'y font rien", () => {
    expect(stillWatchingRemoteAnswer("paused", PLAY_PAUSE)).toBe("resume");
    expect(stillWatchingRemoteAnswer("paused", PLAY)).toBe("resume");
    for (const intent of [PAUSE, OK, RIGHT, BACK]) expect(stillWatchingRemoteAnswer("paused", intent)).toBeNull();
  });
});

describe("« Vous regardez encore ? » et le focus", () => {
  it("le focus entre sur « Continuer », puis sur « Reprendre » — jamais sur la pause", () => {
    expect(stillWatchingFocusEntry("asking")).toBe(STILL_WATCHING_TV_KEYS.continue);
    expect(stillWatchingFocusEntry("paused")).toBe(STILL_WATCHING_TV_KEYS.resume);
    expect(stillWatchingFocusEntry("none")).toBeNull();
    const none = { grabs: false, refusable: false, failed: false, sheetEntryKey: null };
    expect(preferredFocusOf(STILL_WATCHING_TV_KEYS.continue, none)).toBe(true);
    expect(preferredFocusOf(STILL_WATCHING_TV_KEYS.resume, none)).toBe(true);
    expect(preferredFocusOf(STILL_WATCHING_TV_KEYS.pause, none)).toBeUndefined();
  });

  it("l'entrée de l'encart est RÉCLAMÉE à son apparition, en cinquième, après la feuille", () => {
    const base = { loading: false, failed: false, upNextShown: false, endShown: false, sheetEntryKey: null };
    expect(playerFocusClaims({ ...base, stillWatchingEntry: STILL_WATCHING_TV_KEYS.continue })[4])
      .toEqual({ key: STILL_WATCHING_TV_KEYS.continue, active: true });
    expect(playerFocusClaims(base)[4]).toEqual({ key: null, active: false });
  });
});

describe("« Vous regardez encore ? » dans le lecteur", () => {
  const base: PlayerChromeState = {
    playing: true, overlayVisible: true, pinned: true, scrubbing: false, autoPlayActive: false, panelShown: false,
    endScreenShown: false, troubleCovers: false, skipShown: true, upNextShown: true,
  };

  it("l'encart prend le coin : l'habillage, la pilule de saut et la carte « À suivre » se taisent", () => {
    const shown = playerChromeVisibility({ ...base, stillWatchingShown: true });
    expect(shown).toMatchObject({ osdVisible: false, osdShown: false, pillShown: false, upNextShown: false });
    expect(playerChromeVisibility(base)).toMatchObject({ osdShown: true, pillShown: true, upNextShown: true });
  });

  it("il tient la télécommande comme un panneau : le fond ne prend pas le focus", () => {
    const state = { loading: false, overlayVisible: false, pinned: false, scrubbing: false, showSettings: false, showEpisodes: false, autoPlayActive: false, troubleCovers: false, overlayKind: "none" };
    expect(playerBackgroundFocus({ ...state, stillWatchingShown: true })).toEqual({ panelOpen: true, focusable: false, claims: false });
  });

  it("Retour répond « Continuer » pendant la question, avant l'habillage et la feuille ouverte plus tôt", () => {
    const layers = (s: Partial<Parameters<typeof playerBackLayers>[0]>) =>
      resolveBack(playerBackLayers({ transient: false, showSettings: false, showEpisodes: false, osdShown: false, ...s }), { pushed: true });
    expect(layers({ stillWatchingAsking: true, osdShown: true })).toMatchObject({ action: "keepWatching" });
    expect(layers({ stillWatchingAsking: false })).toMatchObject({ action: "leave" });
  });
});
