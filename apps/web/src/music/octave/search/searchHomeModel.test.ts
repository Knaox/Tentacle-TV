import { describe, expect, it } from "vitest";
import { externalTrack, libraryTrack } from "@tentacle-tv/shared/octave/testing";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { buildListenedCards, LISTENED_CARDS_MAX } from "./searchHomeModel";
import { albumTargetOf, queryOfContext, withListen, type SearchListen } from "./searchListens";

const dragons = [{ name: "Imagine Dragons", mbid: null, jellyfinId: null }];
const believer = externalTrack("sillon", "bel", { title: "Believer", artists: dragons, album: { title: "Evolve", mbid: null, jellyfinId: null } });
const thunder = externalTrack("sillon", "thu", { title: "Thunder", artists: dragons, album: { title: "Evolve", mbid: null, jellyfinId: null } });
const radioactive = externalTrack("sillon", "rad", { title: "Radioactive", artists: dragons, album: { title: "Night Visions", mbid: null, jellyfinId: null } });
const queen = libraryTrack("q1", { title: "Bohemian Rhapsody", artists: [{ name: "Queen", mbid: null, jellyfinId: "a-q" }], album: { title: "A Night at the Opera", mbid: null, jellyfinId: "al-q" } });

function listen(track: MusicTrack, query: string | null, at: number, albumTarget: string | null = null): SearchListen {
  return { track, query, albumTarget, at };
}

describe("ce qu'on a écouté après une recherche (Octave)", () => {
  it("la file d'une recherche dit sa requête, ses listes annexes comprises", () => {
    expect(queryOfContext("search:imagine dragons")).toBe("imagine dragons");
    expect(queryOfContext("search:imagine dragons:side")).toBe("imagine dragons");
    expect(queryOfContext("search:a:b:tracks")).toBe("a:b");
    expect(queryOfContext("album:al-1")).toBeNull();
    expect(queryOfContext(null)).toBeNull();
  });

  it("l'album : celui de la bibliothèque, sinon la page d'album d'où le titre a été lancé", () => {
    expect(albumTargetOf(queen, "search:queen")).toBe("al-q");
    expect(albumTargetOf(believer, "album:ext:sillon:evolve")).toBe("ext:sillon:evolve");
    expect(albumTargetOf(believer, "liked")).toBeNull();
  });

  it("un titre réécouté remonte une fois, et garde la recherche qui l'avait fait découvrir", () => {
    let list = withListen([], listen(believer, "imagine dragons", 1, "ext:sillon:evolve"));
    list = withListen(list, listen(queen, null, 2));
    list = withListen(list, listen(believer, null, 3));
    expect(list.map((l) => l.track.key)).toEqual([believer.key, queen.key]);
    expect(list[0]).toMatchObject({ query: "imagine dragons", albumTarget: "ext:sillon:evolve", at: 3 });
    expect(withListen(list, listen(thunder, null, 4), 2)).toHaveLength(2);
  });
});

describe("le « déjà écouté » avant la frappe (Octave)", () => {
  it("« imagine dragons » → l'album et le titre écoutés ensuite, même lancés depuis la page de l'album", () => {
    const listens = [listen(thunder, null, 3, "ext:sillon:evolve"), listen(believer, "imagine dragons", 2, "ext:sillon:evolve")];
    const [card] = buildListenedCards({ recents: ["imagine dragons"], listens, history: [] });
    expect(card).toMatchObject({ query: "imagine dragons", albumTitle: "Evolve", artists: "Imagine Dragons", albumTarget: "ext:sillon:evolve" });
    expect(card.tracks.map((t) => t.title)).toEqual(["Thunder", "Believer"]);
  });

  it("une file née de la recherche compte même si son texte ne lui répond pas", () => {
    const cards = buildListenedCards({ recents: ["le titre du film top gun"], listens: [listen(queen, "Le titre du film Top Gun", 1)], history: [] });
    expect(cards.map((c) => c.tracks[0].title)).toEqual(["Bohemian Rhapsody"]);
  });

  it("l'historique de la bibliothèque complète ce que l'appareil sait", () => {
    const cards = buildListenedCards({ recents: ["imagine dragons", "queen"], listens: [], history: [queen, radioactive] });
    expect(cards.map((c) => [c.query, c.tracks[0].title, c.albumTarget])).toEqual([
      ["imagine dragons", "Radioactive", null],
      ["queen", "Bohemian Rhapsody", "al-q"],
    ]);
  });

  it("dans l'ordre des recherches ; une recherche sans écoute n'a pas de carte ; un album n'est pas redit", () => {
    const listens = [listen(believer, "imagine dragons", 3), listen(radioactive, null, 2)];
    const cards = buildListenedCards({ recents: ["dragons", "personne", "imagine dragons"], listens, history: [] });
    // « Evolve » est né de « imagine dragons » : « dragons » montre l'autre album écouté.
    expect(cards.map((c) => [c.query, c.albumTitle])).toEqual([
      ["dragons", "Night Visions"],
      ["imagine dragons", "Evolve"],
    ]);
  });

  it("un album né d'une recherche reste à elle, même si une recherche plus récente lui répond par le texte", () => {
    const listens = [listen(believer, "imagine dragons", 2), listen(radioactive, null, 1)];
    const cards = buildListenedCards({ recents: ["evolve imagine dragons", "imagine dragons"], listens, history: [] });
    expect(cards.map((c) => [c.query, c.albumTitle])).toEqual([["imagine dragons", "Evolve"]]);
  });

  it("jamais plus que le maximum ; rien sans recherche", () => {
    const recents = ["a1", "a2", "a3", "a4", "a5", "a6"];
    const listens = recents.map((q, i) => listen(libraryTrack(`t${i}`, { album: { title: `Album ${i}`, mbid: null, jellyfinId: `al${i}` } }), q, i));
    expect(buildListenedCards({ recents, listens, history: [] })).toHaveLength(LISTENED_CARDS_MAX);
    expect(buildListenedCards({ recents: [], listens, history: [queen] })).toEqual([]);
  });
});
