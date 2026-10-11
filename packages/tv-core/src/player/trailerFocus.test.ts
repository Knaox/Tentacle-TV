import { describe, expect, it } from "vitest";
import { TRAILER_CLOSE_KEY } from "./trailerChrome";
import {
  TRAILER_QUALITY_KEY, TRAILER_SUBTITLES_KEY, TRAILER_TIMELINE_KEY,
  trailerEntryKey, trailerFocusable, trailerFocusClaim, trailerNeighbor, trailerPanelReturnKey, trailerTargets,
  type TrailerFocusView,
} from "./trailerFocus";

const BOTH = { subtitles: true, quality: true };
const NONE = { subtitles: false, quality: false };
const view = (init: Partial<TrailerFocusView> = {}): TrailerFocusView => ({
  state: "playing", tools: BOTH, chromeShown: true, panel: null, ...init,
});

describe("les cibles et l'entrée", () => {
  it("en lecture : la croix, les boutons présents, la barre — dans l'ordre de lecture", () => {
    expect(trailerTargets(view())).toEqual([TRAILER_CLOSE_KEY, TRAILER_SUBTITLES_KEY, TRAILER_QUALITY_KEY, TRAILER_TIMELINE_KEY]);
    expect(trailerTargets(view({ tools: { subtitles: false, quality: true } }))).toEqual([
      TRAILER_CLOSE_KEY, TRAILER_QUALITY_KEY, TRAILER_TIMELINE_KEY,
    ]);
  });

  it("sans la capacité du serveur (aucun bouton) : la croix et la barre — avancer et reculer restent", () => {
    expect(trailerTargets(view({ tools: NONE }))).toEqual([TRAILER_CLOSE_KEY, TRAILER_TIMELINE_KEY]);
  });

  it("hors lecture, la croix seule", () => {
    expect(trailerTargets(view({ state: "loading" }))).toEqual([TRAILER_CLOSE_KEY]);
    expect(trailerTargets(view({ state: "unavailable" }))).toEqual([TRAILER_CLOSE_KEY]);
  });

  it("l'entrée : la barre en lecture, la croix sinon", () => {
    expect(trailerEntryKey("playing")).toBe(TRAILER_TIMELINE_KEY);
    expect(trailerEntryKey("loading")).toBe(TRAILER_CLOSE_KEY);
    expect(trailerEntryKey("unavailable")).toBe(TRAILER_CLOSE_KEY);
  });
});

describe("ce qui se focalise", () => {
  it("chrome affiché : toutes les cibles montées", () => {
    for (const key of trailerTargets(view())) expect(trailerFocusable(key, view())).toBe(true);
  });

  it("chrome estompé : la barre seule — ce qu'on ne voit pas ne se focalise pas", () => {
    const dim = view({ chromeShown: false });
    expect(trailerFocusable(TRAILER_TIMELINE_KEY, dim)).toBe(true);
    for (const key of [TRAILER_CLOSE_KEY, TRAILER_SUBTITLES_KEY, TRAILER_QUALITY_KEY]) expect(trailerFocusable(key, dim)).toBe(false);
  });

  it("un bouton absent, ou un panneau ouvert : rien sur l'écran", () => {
    expect(trailerFocusable(TRAILER_QUALITY_KEY, view({ tools: NONE }))).toBe(false);
    for (const key of trailerTargets(view())) expect(trailerFocusable(key, view({ panel: "subtitles" }))).toBe(false);
  });
});

describe("les réclamations", () => {
  it("le chrome s'estompe sur un bouton : la barre reprend le focus (OK puis OK)", () => {
    expect(trailerFocusClaim(view({ chromeShown: false }), TRAILER_SUBTITLES_KEY)).toBe(TRAILER_TIMELINE_KEY);
    expect(trailerFocusClaim(view({ chromeShown: false }), TRAILER_CLOSE_KEY)).toBe(TRAILER_TIMELINE_KEY);
    expect(trailerFocusClaim(view({ chromeShown: false }), TRAILER_TIMELINE_KEY)).toBeNull();
  });

  it("un focus perdu ou sur une cible disparue : l'entrée ; un focus valable reste", () => {
    expect(trailerFocusClaim(view(), null)).toBe(TRAILER_TIMELINE_KEY);
    expect(trailerFocusClaim(view({ state: "unavailable" }), TRAILER_TIMELINE_KEY)).toBe(TRAILER_CLOSE_KEY);
    expect(trailerFocusClaim(view({ tools: NONE }), TRAILER_QUALITY_KEY)).toBe(TRAILER_TIMELINE_KEY);
    expect(trailerFocusClaim(view(), TRAILER_QUALITY_KEY)).toBeNull();
  });

  it("panneau ouvert : la feuille a la main", () => {
    expect(trailerFocusClaim(view({ panel: "quality" }), "trailerQuality:list:720")).toBeNull();
  });

  it("un panneau refermé rend le focus à son bouton, si le chrome est là", () => {
    expect(trailerPanelReturnKey("subtitles", true)).toBe(TRAILER_SUBTITLES_KEY);
    expect(trailerPanelReturnKey("quality", true)).toBe(TRAILER_QUALITY_KEY);
    expect(trailerPanelReturnKey("quality", false)).toBeNull();
  });
});

describe("les voisins", () => {
  it("la barre garde ←/→ (la vidéo) ; ↑ retrouve le dernier bouton, sinon le premier, sinon la croix", () => {
    expect(trailerNeighbor(TRAILER_TIMELINE_KEY, "gauche", view())).toBe("stay");
    expect(trailerNeighbor(TRAILER_TIMELINE_KEY, "droite", view())).toBe("stay");
    expect(trailerNeighbor(TRAILER_TIMELINE_KEY, "bas", view())).toBe("stay");
    expect(trailerNeighbor(TRAILER_TIMELINE_KEY, "haut", view())).toBe(TRAILER_SUBTITLES_KEY);
    expect(trailerNeighbor(TRAILER_TIMELINE_KEY, "haut", view(), TRAILER_QUALITY_KEY)).toBe(TRAILER_QUALITY_KEY);
    expect(trailerNeighbor(TRAILER_TIMELINE_KEY, "haut", view({ tools: NONE }))).toBe(TRAILER_CLOSE_KEY);
    expect(trailerNeighbor(TRAILER_TIMELINE_KEY, "haut", view({ tools: NONE }), TRAILER_QUALITY_KEY)).toBe(TRAILER_CLOSE_KEY);
  });

  it("chrome estompé : ↑ depuis la barre ne mène nulle part (il rallume le chrome)", () => {
    expect(trailerNeighbor(TRAILER_TIMELINE_KEY, "haut", view({ chromeShown: false }))).toBe("stay");
  });

  it("les boutons : entre eux à l'horizontale, la croix en haut, la barre en bas", () => {
    expect(trailerNeighbor(TRAILER_SUBTITLES_KEY, "droite", view())).toBe(TRAILER_QUALITY_KEY);
    expect(trailerNeighbor(TRAILER_QUALITY_KEY, "gauche", view())).toBe(TRAILER_SUBTITLES_KEY);
    expect(trailerNeighbor(TRAILER_SUBTITLES_KEY, "gauche", view())).toBe("stay");
    expect(trailerNeighbor(TRAILER_QUALITY_KEY, "droite", view())).toBe("stay");
    expect(trailerNeighbor(TRAILER_SUBTITLES_KEY, "haut", view())).toBe(TRAILER_CLOSE_KEY);
    expect(trailerNeighbor(TRAILER_QUALITY_KEY, "bas", view())).toBe(TRAILER_TIMELINE_KEY);
  });

  it("la croix : ↓ vers le premier bouton, sinon la barre ; ailleurs elle reste", () => {
    expect(trailerNeighbor(TRAILER_CLOSE_KEY, "bas", view())).toBe(TRAILER_SUBTITLES_KEY);
    expect(trailerNeighbor(TRAILER_CLOSE_KEY, "bas", view({ tools: NONE }))).toBe(TRAILER_TIMELINE_KEY);
    expect(trailerNeighbor(TRAILER_CLOSE_KEY, "droite", view())).toBe("stay");
    expect(trailerNeighbor(TRAILER_CLOSE_KEY, "bas", view({ state: "unavailable" }))).toBe("stay");
  });

  it("une clé inconnue reste", () => {
    expect(trailerNeighbor("ailleurs", "bas", view())).toBe("stay");
  });
});
