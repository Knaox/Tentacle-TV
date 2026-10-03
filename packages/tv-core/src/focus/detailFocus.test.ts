import { describe, expect, it } from "vitest";
import {
  DETAIL_ROWS,
  DETAIL_ROW_EDGES,
  detailAnchorIndex,
  detailEntryAfterPlayLost,
  detailEntryKey,
  detailEpisodeAnchorKey,
  detailSeasonEntryKey,
  isDetailEpisodeKey,
} from "./detailFocus";

const READY = { error: false, ready: true, play: true, trailer: true };

describe("entrée de la fiche", () => {
  it("Lecture d'abord, sinon la bande-annonce, sinon Ma liste — jamais la croix", () => {
    expect(detailEntryKey(READY)).toBe("detail:primary");
    expect(detailEntryKey({ ...READY, play: false })).toBe("detail:trailer");
    expect(detailEntryKey({ ...READY, play: false, trailer: false })).toBe("detail:list");
  });

  it("une fiche en erreur entre par « Réessayer », même avant tout le reste", () => {
    expect(detailEntryKey({ ...READY, error: true })).toBe("status:primary");
    expect(detailEntryKey({ error: true, ready: false, play: false, trailer: false })).toBe("status:primary");
  });

  it("une fiche qui se charge n'a pas d'entrée", () => {
    expect(detailEntryKey({ ...READY, ready: false })).toBeNull();
  });
});

describe("pilule de lecture qui disparaît", () => {
  const LOST = { hadPlay: true, hasPlay: false, lastFocusedKey: "detail:primary", entryKey: "detail:trailer" };

  it("rend le focus à la nouvelle entrée si elle l'avait en dernier", () => {
    expect(detailEntryAfterPlayLost(LOST)).toBe("detail:trailer");
  });

  it("ne réclame rien si le focus était ailleurs", () => {
    expect(detailEntryAfterPlayLost({ ...LOST, lastFocusedKey: "season:2" })).toBeNull();
  });

  it("ne réclame rien tant que la pilule est là, ni quand elle apparaît", () => {
    expect(detailEntryAfterPlayLost({ ...LOST, hasPlay: true })).toBeNull();
    expect(detailEntryAfterPlayLost({ ...LOST, hadPlay: false, hasPlay: true })).toBeNull();
  });

  it("sans entrée de rechange, rien", () => {
    expect(detailEntryAfterPlayLost({ ...LOST, entryKey: null })).toBeNull();
  });
});

describe("entrées des sections de la fiche", () => {
  it("les onglets entrent par la saison AFFICHÉE", () => {
    expect(detailSeasonEntryKey(["s1", "s2", "s3"], "s3")).toBe("season:2");
  });

  it("une saison affichée hors de la bande : aucune entrée (la règle commune)", () => {
    expect(detailSeasonEntryKey(["s1", "s2"], "s9")).toBeNull();
    expect(detailSeasonEntryKey(["s1", "s2"], undefined)).toBeNull();
  });

  it("les épisodes entrent par l'épisode d'ancrage, le premier à défaut", () => {
    expect(detailEpisodeAnchorKey(12, 4)).toBe("episode:4");
    expect(detailEpisodeAnchorKey(12, undefined)).toBe("episode:0");
    expect(detailEpisodeAnchorKey(0, 4)).toBeNull();
  });

  it("seules les clés d'épisode désarment la première visite", () => {
    expect(isDetailEpisodeKey("episode:3")).toBe(true);
    expect(isDetailEpisodeKey("season:3")).toBe(false);
  });

  it("l'ancre : l'épisode à reprendre s'il est dans la saison, sinon le premier", () => {
    expect(detailAnchorIndex(["e1", "e2", "e3"], "e3")).toBe(2);
    expect(detailAnchorIndex(["e1", "e2", "e3"], "x")).toBe(0);
    expect(detailAnchorIndex(null, "e1")).toBe(0);
    expect(detailAnchorIndex(["e1"], undefined)).toBe(0);
  });
});

describe("bouts des rangées", () => {
  it("toutes les rangées de la fiche retiennent le focus de côté — l'en-tête non", () => {
    expect(DETAIL_ROWS).toEqual([
      "detail:seasons", "detail:episodes", "detail:cast", "detail:extras", "detail:saga", "detail:collection", "detail:similar",
    ]);
    expect(DETAIL_ROWS).not.toContain("detail:header");
    expect(DETAIL_ROW_EDGES).toEqual({ trapLeft: true, trapRight: true });
  });
});
