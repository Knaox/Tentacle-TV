/**
 * La règle de rapprochement face aux titres d'un IMPORT (Damien, 26/10 : sa playlist Apple Music « New ») : les
 * mentions qu'une boutique TRADUIT, les versions qui restent des versions, la durée d'un autre master, et l'album
 * de la source quand la bibliothèque a le titre sur plusieurs albums. Titres et durées relevés sur l'iTunes Search
 * (FR et US) le 26/10.
 */

import { describe, expect, it } from "vitest";
import { baseTitle, bestMatch, bestTrackMatch, isLikelySameTrack, isSameTrack, type MatchableTrack } from "./musicLibraryMatch";

const t = (title: string, artist: string | string[], durationMs: number | null, albumTitle: string | null = null, over: Partial<MatchableTrack> = {}): MatchableTrack => ({
  title,
  artists: (Array.isArray(artist) ? artist : [artist]).map((name) => ({ name, mbid: null })),
  albumTitle,
  durationMs,
  recording: null,
  ...over,
});

describe("mentions traduites et suffixes de boutique", () => {
  it("« (from the series …) », « (extrait de la série …) », « - from … » : le titre de base", () => {
    expect(baseTitle("Ma Meilleure Ennemie (from the series Arcane League of Legends)")).toBe("ma meilleure ennemie");
    expect(baseTitle("Ma Meilleure Ennemie (extrait de la série Arcane League of Legends)")).toBe("ma meilleure ennemie");
    expect(baseTitle("Ma Meilleure Ennemie - from the series Arcane League of Legends")).toBe("ma meilleure ennemie");
    expect(baseTitle("Il était une fois (tiré du film « Shrek »)")).toBe("il etait une fois");
    expect(baseTitle("Despacito (con Daddy Yankee)")).toBe("despacito");
    expect(baseTitle("Imagine (Remasterisé 2010)")).toBe("imagine");
    expect(baseTitle("Imagine - Remasterisé 2010")).toBe("imagine");
    expect(baseTitle("lovely (with Khalid)")).toBe("lovely");
    expect(baseTitle('What Was I Made For? [From The Motion Picture "Barbie"]')).toBe("what was i made for");
  });

  it("une VERSION reste une version, même avec « from » : « (Live from Wembley) », « (Remix feat. X) »", () => {
    expect(baseTitle("Song (Live from Wembley)")).toBe("song live from wembley");
    expect(baseTitle("Song (Remix feat. X)")).toBe("song remix"); // l’invité part, la version reste
    expect(baseTitle("Song (feat. X) [Radio Edit]")).toBe("song radio edit");
    expect(baseTitle("Ma meilleure ennemie (Dal vivo)")).toBe("ma meilleure ennemie dal vivo");
  });

  it("un mot qui CONTIENT un mot-bruit n'est pas un bruit (« Confession », « Mitten », « Fromage »)", () => {
    expect(baseTitle("Song (Confession)")).toBe("song confession");
    expect(baseTitle("Song (Mitten im Winter)")).toBe("song mitten im winter");
    expect(baseTitle("Song (Fromage)")).toBe("song fromage");
  });

  it("Stromae & Pomme, page Apple Music FR contre la bibliothèque (MusicBrainz) : reconnu", () => {
    const own = t("Ma meilleure ennemie", "Stromae & Pomme", 148_000, "Arcane League of Legends: Season 2");
    const apple = t("Ma Meilleure Ennemie (extrait de la série Arcane League of Legends)", ["Stromae", "Pomme"], 147_973, "Arcane League of Legends: Season 2 (Soundtrack from the Animated Series)");
    expect(isSameTrack(own, apple)).toBe(true);
  });

  it("« L’AMOUR DE MA VIE » (apostrophe typographique d'un côté, droite de l'autre)", () => {
    expect(isSameTrack(t("L'AMOUR DE MA VIE", "Billie Eilish", 334_000), t("L’AMOUR DE MA VIE", "Billie Eilish", 333_987))).toBe(true);
  });
});

describe("le second rang : un autre master du même enregistrement", () => {
  const own = t("BIRDS OF A FEATHER", "Billie Eilish", 214_100, "HIT ME HARD AND SOFT");

  it("± 2 s ne suffit pas toujours : 3,7 s d'écart, même titre, même artiste → c'est lui (second rang)", () => {
    const apple = t("BIRDS OF A FEATHER", "Billie Eilish", 210_373, "HIT ME HARD AND SOFT");
    expect(isSameTrack(own, apple)).toBe(false);
    expect(isLikelySameTrack(own, apple)).toBe(true);
    expect(bestTrackMatch(apple, [own], (x) => x)).toBe(own);
  });

  it("une autre VERSION s'écarte bien plus (Ma Meilleure Ennemie avec Coldplay : 3:22 contre 2:28) → jamais", () => {
    const own2 = t("Ma meilleure ennemie", "Stromae & Pomme", 147_973);
    const coldplay = t("Ma Meilleure Ennemie (feat. Elyanna, Arcane & League of Legends Music)", ["Stromae", "Pomme", "Coldplay"], 201_933);
    expect(isLikelySameTrack(own2, coldplay)).toBe(false);
  });

  it("un homonyme d'un autre artiste, ou deux MBID différents, ne passent jamais au second rang", () => {
    expect(isLikelySameTrack(own, t("BIRDS OF A FEATHER", "Someone Else", 211_000))).toBe(false);
    const a = { recording: "6ad408a2-797a-426c-8ab4-c75481265b1e" };
    const b = { recording: "4a6428c7-178d-48bb-81ae-7fb1e264da80" };
    expect(isLikelySameTrack(t("X", "Y", 200_000, null, a), t("X", "Y", 203_000, null, b))).toBe(false);
  });

  it("un titre long : 3 % (8 min → 14 s) ; sans durée d'un côté, le premier rang seul juge", () => {
    expect(isLikelySameTrack(t("Long", "A", 480_000), t("Long", "A", 493_000))).toBe(true);
    expect(isLikelySameTrack(t("Long", "A", 480_000), t("Long", "A", 496_000))).toBe(false);
    expect(isLikelySameTrack(t("Long", "A", null), t("Long", "A", 496_000))).toBe(true);
  });
});

describe("le BON album : celui de la source, sinon celui de l'artiste", () => {
  const single = t("lovely", "Billie Eilish & Khalid", 200_187, "lovely");
  const ost = t("lovely", "Billie Eilish & Khalid", 200_200, "13 Reasons Why (Season 2)", { albumArtist: "Various Artists" });
  const album = t("lovely", "Billie Eilish & Khalid", 200_900, "dont smile at me (Expanded Edition)");
  const own = [ost, single, album];

  it("l'album de la source l'emporte sur la durée la plus proche", () => {
    expect(bestTrackMatch(t("lovely (with Khalid)", ["Billie Eilish", "Khalid"], 200_187, "dont smile at me"), own, (x) => x)).toBe(album);
    expect(bestTrackMatch(t("lovely", ["Billie Eilish"], 200_190, "13 Reasons Why (Season 2)"), own, (x) => x)).toBe(ost);
  });

  it("source sans album dans la bibliothèque : l'album de l'artiste plutôt que le recueil, puis la durée", () => {
    expect(bestTrackMatch(t("lovely", "Billie Eilish", 200_200, "Hits 2018"), own, (x) => x)).toBe(single);
  });

  it("le premier rang passe devant le second, à album égal", () => {
    const near = t("lovely", "Billie Eilish", 200_000, "lovely");
    const far = t("lovely", "Billie Eilish", 204_500, "lovely");
    expect(bestTrackMatch(t("lovely", "Billie Eilish", 201_000, "lovely"), [far, near], (x) => x)).toBe(near);
    expect(bestMatch(t("lovely", "Billie Eilish", 201_000, "lovely"), [far], (x) => x)).toBeNull();
  });
});
