import { describe, expect, it } from "vitest";
import {
  episodesEntryKey, exitLocked, panelOpener, panelReturnTarget, playerFocusClaims, preferredFocusOf, sheetEntryKey,
  skipIslandGuides, skipPillFocus, timelineBridgeTarget, troubleBridgeTarget,
} from "./playerFocus";
import { playerBackgroundFocus, playerChromeVisibility, type PlayerChromeState } from "./playerStage";
import { activatesTroublePanel, troubleLeaveReturnsToOsd } from "./troublePanel";

describe("la pilule de saut et le focus", () => {
  it("un passage automatique non refusé prend le focus sur « Masquer »", () => {
    const pill = skipPillFocus({ overlay: { kind: "skip", auto: true, dismissible: true }, pillShown: true, showSettings: false });
    expect(pill).toEqual({ refusable: true, grabs: true });
    expect(preferredFocusOf("player:skip-dismiss", { ...pill, failed: false, sheetEntryKey: null })).toBe(true);
    expect(preferredFocusOf("player:skip", { ...pill, failed: false, sheetEntryKey: null })).toBe(false);
  });

  it("un passage à demander prend le focus sur « Passer » ; en sourdine, ou sous la feuille, il ne le prend pas", () => {
    const manual = skipPillFocus({ overlay: { kind: "skip", auto: false, dismissible: true }, pillShown: true, showSettings: false });
    expect(manual).toEqual({ refusable: false, grabs: true });
    expect(preferredFocusOf("player:skip", { ...manual, failed: false, sheetEntryKey: null })).toBe(true);
    expect(skipPillFocus({ overlay: { kind: "skip", auto: true, dismissible: false }, pillShown: true, showSettings: false }).grabs).toBe(false);
    expect(skipPillFocus({ overlay: { kind: "nextButton", dismissible: true }, pillShown: true, showSettings: true }).grabs).toBe(false);
  });

  it("l'îlot retient le focus pendant un passage automatique, habillage caché ; ses sorties avec l'habillage", () => {
    expect(skipIslandGuides({ refusable: true, overlayVisible: false, islandFocused: true })).toEqual({ trap: true, exits: false });
    expect(skipIslandGuides({ refusable: true, overlayVisible: true, islandFocused: true })).toEqual({ trap: false, exits: true });
    expect(skipIslandGuides({ refusable: false, overlayVisible: true, islandFocused: false })).toEqual({ trap: false, exits: false });
  });
});

describe("les entrées et les croix", () => {
  it("l'ouverture : la croix, ou « Réessayer » après un échec ; carte, fin et feuille réclament leur entrée", () => {
    const claims = playerFocusClaims({ loading: true, failed: false, upNextShown: false, endShown: true, sheetEntryKey: "tracks:audio:2" });
    expect(claims).toEqual([
      { key: "loading:back", active: true }, { key: "upnext:play", active: false },
      { key: "end:play", active: true }, { key: "tracks:audio:2", active: true },
    ]);
    expect(playerFocusClaims({ loading: true, failed: true, upNextShown: false, endShown: false, sheetEntryKey: null })[0]).toEqual({ key: "loading:retry", active: true });
  });

  it("une croix reste verrouillée tant que l'entrée de son écran n'a pas eu le focus", () => {
    expect(exitLocked(true, false)).toBe(true);
    expect(exitLocked(true, true)).toBe(false);
    expect(exitLocked(false, false)).toBe(false);
  });

  it("la feuille entre par l'option retenue, sinon la première, sinon la croix", () => {
    expect(sheetEntryKey("tracks", "audio", [{ key: "0" }, { key: "1", selected: true }])).toBe("tracks:audio:1");
    expect(sheetEntryKey("settings", "quality", [{ key: "original" }])).toBe("settings:quality:original");
    expect(sheetEntryKey("tracks", "audio", [])).toBe("tracks:close");
  });

  it("les épisodes entrent par l'épisode en cours, sinon la première ligne", () => {
    expect(episodesEntryKey(true, ["a", "b", "c"], "c")).toBe("episodes:episode:2");
    expect(episodesEntryKey(true, ["a", "b"], "z")).toBe("episodes:episode:0");
    expect(episodesEntryKey(true, undefined, "a")).toBeNull();
    expect(episodesEntryKey(false, ["a"], "a")).toBeNull();
  });
});

describe("les ponts", () => {
  it("la frise : de Retour vers lecture/pause, sinon vers la pilule ou Retour", () => {
    expect(timelineBridgeTarget("player:back", true)).toBe("player:playpause");
    expect(timelineBridgeTarget("player:playpause", true)).toBe("player:skip");
    expect(timelineBridgeTarget("player:playpause", false)).toBe("player:back");
  });

  it("le message-outil : de la croix vers « Réessayer », sinon vers la croix", () => {
    expect(troubleBridgeTarget("trouble:back")).toBe("trouble:retry");
    expect(troubleBridgeTarget("trouble:retry")).toBe("trouble:back");
  });
});

describe("le retour d'un panneau", () => {
  it("rend le focus au bouton du dernier panneau ouvert, si l'habillage est là", () => {
    let opener = panelOpener({ showSettings: true, showEpisodes: false, sheetOpener: "player:settings", previous: null });
    expect(opener).toBe("player:settings");
    opener = panelOpener({ showSettings: false, showEpisodes: false, sheetOpener: "player:tracks", previous: opener });
    expect(panelReturnTarget(opener, true)).toBe("player:settings");
    expect(panelReturnTarget(opener, false)).toBeNull();
    expect(panelOpener({ showSettings: false, showEpisodes: true, sheetOpener: "player:tracks", previous: null })).toBe("player:episodes");
  });
});

describe("ce que l'habillage montre, et le fond", () => {
  const base: PlayerChromeState = {
    playing: true, overlayVisible: false, pinned: false, scrubbing: false, autoPlayActive: false, panelShown: false,
    endScreenShown: false, troubleCovers: false, skipShown: false, upNextShown: false,
  };

  it("la pause épingle l'habillage hors défilement ; la carte « À suivre » le tait", () => {
    expect(playerChromeVisibility({ ...base, pinned: true }).osdShown).toBe(true);
    expect(playerChromeVisibility({ ...base, pinned: true, scrubbing: true }).osdShown).toBe(false);
    expect(playerChromeVisibility({ ...base, overlayVisible: true, autoPlayActive: true }).osdVisible).toBe(false);
  });

  it("ce qui recouvre fait taire la pilule et la carte", () => {
    expect(playerChromeVisibility({ ...base, skipShown: true }).pillShown).toBe(true);
    expect(playerChromeVisibility({ ...base, skipShown: true, panelShown: true }).pillShown).toBe(false);
    expect(playerChromeVisibility({ ...base, upNextShown: true, playing: false }).upNextShown).toBe(false);
  });

  it("le fond tient le focus habillage caché, rien par-dessus ; il ne le réclame pas sous une pilule", () => {
    const state = { loading: false, overlayVisible: false, pinned: false, scrubbing: false, showSettings: false, showEpisodes: false, autoPlayActive: false, troubleCovers: false, overlayKind: "none" };
    expect(playerBackgroundFocus(state)).toEqual({ panelOpen: false, focusable: true, claims: true });
    expect(playerBackgroundFocus({ ...state, overlayKind: "skip" }).claims).toBe(false);
    expect(playerBackgroundFocus({ ...state, loading: true }).focusable).toBe(false);
    expect(playerBackgroundFocus({ ...state, autoPlayActive: true })).toEqual({ panelOpen: true, focusable: false, claims: false });
    expect(playerBackgroundFocus({ ...state, pinned: true, scrubbing: true }).focusable).toBe(true);
  });
});

describe("le message-outil", () => {
  it("s'active au premier APPUI — jamais par le pavé, ni Retour", () => {
    expect(activatesTroublePanel({ type: "select" })).toBe(true);
    expect(activatesTroublePanel({ type: "playPause" })).toBe(true);
    expect(activatesTroublePanel({ type: "move", direction: "bas" })).toBe(true);
    expect(activatesTroublePanel({ type: "hold", key: "select", phase: "start" })).toBe(true);
    expect(activatesTroublePanel({ type: "hold", key: "droite", phase: "start" })).toBe(false);
    expect(activatesTroublePanel({ type: "retour" })).toBe(false);
    expect(activatesTroublePanel({ type: "drag", phase: "start", x: 0, y: 0, vx: 0, vy: 0 })).toBe(false);
    expect(activatesTroublePanel({ type: "swipe", direction: "gauche" })).toBe(false);
  });

  it("rend le focus à l'habillage en partant, s'il le tenait et que l'habillage est là", () => {
    expect(troubleLeaveReturnsToOsd("trouble:retry", true)).toBe(true);
    expect(troubleLeaveReturnsToOsd("trouble:retry", false)).toBe(false);
    expect(troubleLeaveReturnsToOsd("player:playpause", true)).toBe(false);
  });
});
