/**
 * Le texte des annonces d'arrivée : accord, regroupement par saison, anglais,
 * forme personnelle du demandeur, et la fiche ouverte au tap.
 */

import { describe, expect, it } from "vitest";
import type { LibItem } from "./jellyfinLibrary";
import { composeItems, composeRequested, pushTarget } from "./libraryAddedFormat";

const movie = (id: string, name: string): LibItem => ({ Id: id, Name: name, Type: "Movie", tmdbId: 1 });
const episode = (id: string, series: string, s: number, e: number, name = `Épisode ${e}`): LibItem => ({
  Id: id,
  Name: name,
  Type: "Episode",
  SeriesName: series,
  SeriesId: `series-${series}`,
  ParentIndexNumber: s,
  IndexNumber: e,
});
const seriesItem: LibItem = { Id: "s", Name: "The Bear", Type: "Series" };

describe("annonce aux abonnés", () => {
  it("un film : son titre, « est sorti »", () => {
    expect(composeItems([movie("m1", "Dune")])).toEqual({ title: "Dune", body: "est sorti sur Tentacle TV" });
  });

  it("un épisode isolé : série, code et titre", () => {
    expect(composeItems([episode("e1", "The Bear", 1, 1, "System")])).toEqual({
      title: "The Bear S01E01 — System",
      body: "est sorti sur Tentacle TV",
    });
  });

  it("plusieurs épisodes d'une saison : un libellé au féminin", () => {
    const items = [episode("e1", "The Bear", 1, 1), episode("e2", "The Bear", 1, 2)];
    expect(composeItems(items)).toEqual({
      title: "The Bear — Saison 1 (2 épisodes)",
      body: "est sortie sur Tentacle TV",
    });
  });

  it("l'item Série ne s'annonce pas seul : jamais « The Bear est sortie » pour un épisode", () => {
    expect(composeItems([seriesItem, episode("e1", "The Bear", 1, 1, "System")]).title).toBe(
      "The Bear S01E01 — System",
    );
  });

  it("plusieurs contenus : un compte et un aperçu borné", () => {
    const items = [movie("a", "A"), movie("b", "B"), movie("c", "C"), movie("d", "D")];
    expect(composeItems(items)).toEqual({ title: "4 nouveautés sur Tentacle TV", body: "A · B · C +1" });
  });

  it("en anglais", () => {
    expect(composeItems([movie("m1", "Dune")], "en")).toEqual({ title: "Dune", body: "Now on Tentacle TV" });
    const season = [episode("e1", "The Bear", 2, 1), episode("e2", "The Bear", 2, 2)];
    expect(composeItems(season, "en").title).toBe("The Bear — Season 2 (2 episodes)");
    expect(composeItems([movie("a", "A"), movie("b", "B")], "en").title).toBe("2 new additions on Tentacle TV");
  });
});

describe("annonce au demandeur", () => {
  it("une demande : sa forme personnelle", () => {
    expect(composeRequested([movie("m1", "Dune")])).toEqual({
      title: "Dune",
      body: "Votre demande est disponible sur Tentacle TV",
    });
    expect(composeRequested([movie("m1", "Dune")], "en").body).toBe("Your request is now on Tentacle TV");
  });

  it("plusieurs demandes à la fois", () => {
    const items = [movie("m1", "Dune"), episode("e1", "The Bear", 1, 1, "System")];
    expect(composeRequested(items)).toEqual({
      title: "Vos demandes sont disponibles",
      body: "Dune · The Bear S01E01 — System",
    });
  });
});

describe("fiche ouverte au tap", () => {
  it("un film : le film", () => {
    expect(pushTarget([movie("m1", "Dune")])).toBe("m1");
  });

  it("des épisodes d'une même série : la série", () => {
    expect(pushTarget([episode("e1", "The Bear", 1, 1), episode("e2", "The Bear", 1, 2)])).toBe("series-The Bear");
  });

  it("plusieurs contenus : pas de fiche, l'accueil", () => {
    expect(pushTarget([movie("m1", "Dune"), movie("m2", "Heat")])).toBeUndefined();
    expect(pushTarget([movie("m1", "Dune"), episode("e1", "The Bear", 1, 1)])).toBeUndefined();
  });
});
