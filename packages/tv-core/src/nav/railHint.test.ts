import { describe, expect, it } from "vitest";

import { railHintEntry, railOrganizeHintEntry, railSettingsHintShown, type RailHintState } from "./railHint";
import { RAIL_HOME_KEY, RAIL_PROFILE_KEY, RAIL_SEARCH_KEY, RAIL_SHOW_ALL_KEY, RAIL_SWITCH_PROFILE_KEY } from "./railKeys";

const state = (entryKey: string | null, patch: Partial<RailHintState> = {}): RailHintState => ({ entryKey, moving: false, menuOpen: false, ...patch });

describe("railHintEntry — l'entrée du rail que désigne le focus", () => {
  it("une entrée du rail ; ni le contenu, ni le menu d'une entrée", () => {
    expect(railHintEntry("nav:Library_films")).toBe("Library_films");
    expect(railHintEntry("nav:Settings")).toBe("Settings");
    expect(railHintEntry("resume:3")).toBeNull();
    expect(railHintEntry("nav:menu:move")).toBeNull();
    expect(railHintEntry(null)).toBeNull();
  });
});

describe("« Maintenir OK : organiser » — tout de suite, à chaque fois", () => {
  it("à côté d'une entrée organisable dès qu'elle a le focus : une bibliothèque, Pour vous, Ma liste, Favoris", () => {
    expect(railOrganizeHintEntry(state("Library_films"))).toBe("Library_films");
    expect(railOrganizeHintEntry(state("Recommendations"))).toBe("Recommendations");
    expect(railOrganizeHintEntry(state("Watchlist"))).toBe("Watchlist");
    expect(railOrganizeHintEntry(state("Favorites"))).toBe("Favorites");
  });

  it("aucune condition de durée ni de compte : la règle ne dépend que de l'entrée et de l'état du rail", () => {
    // Deux passages identiques donnent la même réponse : plus de « premières fois seulement ».
    expect(railOrganizeHintEntry(state("Library_films"))).toBe(railOrganizeHintEntry(state("Library_films")));
  });

  it("jamais sur ce qui ne s'organise pas : Rechercher, Accueil, Tout afficher, Changer de profil, le profil", () => {
    for (const key of [RAIL_SEARCH_KEY, RAIL_HOME_KEY, RAIL_SHOW_ALL_KEY, RAIL_SWITCH_PROFILE_KEY, RAIL_PROFILE_KEY]) {
      expect(railOrganizeHintEntry(state(key))).toBeNull();
    }
  });

  it("ni pendant un déplacement, ni menu ouvert, ni focus hors du rail", () => {
    expect(railOrganizeHintEntry(state("Library_films", { moving: true }))).toBeNull();
    expect(railOrganizeHintEntry(state("Library_films", { menuOpen: true }))).toBeNull();
    expect(railOrganizeHintEntry(state(null))).toBeNull();
  });
});

describe("« ◀ Réglages » — GAUCHE mène aux réglages", () => {
  it("rail focalisé, sur toute entrée sauf le profil", () => {
    for (const key of [RAIL_SEARCH_KEY, RAIL_HOME_KEY, "Library_films", RAIL_SWITCH_PROFILE_KEY, "Requests"]) {
      expect(railSettingsHintShown({ ...state(key), railFocused: true })).toBe(true);
    }
    expect(railSettingsHintShown({ ...state(RAIL_PROFILE_KEY), railFocused: true })).toBe(false);
  });

  it("rail replié, déplacement, menu ouvert ou focus hors du rail : rien", () => {
    expect(railSettingsHintShown({ ...state(RAIL_HOME_KEY), railFocused: false })).toBe(false);
    expect(railSettingsHintShown({ ...state(RAIL_HOME_KEY, { moving: true }), railFocused: true })).toBe(false);
    expect(railSettingsHintShown({ ...state(RAIL_HOME_KEY, { menuOpen: true }), railFocused: true })).toBe(false);
    expect(railSettingsHintShown({ ...state(null), railFocused: true })).toBe(false);
  });
});
