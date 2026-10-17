import { describe, expect, it } from "vitest";
import type { TmdbVideo } from "../../../trailers/trailerList";
import { rankCatalogEntries } from "../../../trailers/trailerCatalogRank";
import { youtubeEntries } from "./catalogEntries";

const yt = (key: string, name: string, type: string, lang?: string): TmdbVideo => ({
  key: key.padEnd(11, "x"), name, type, site: "YouTube", lang, url: `https://www.youtube.com/watch?v=${key.padEnd(11, "x")}`,
});
const MOVIE = { kind: "movie" } as const;
const names = (videos: TmdbVideo[], titleNames: string[]) =>
  rankCatalogEntries(youtubeEntries(videos, MOVIE, "tmdb", "fr-FR", titleNames), [MOVIE]).map((e) => e.name);

describe("catalogue › ce que TMDB rend pour un titre exact", () => {
  it("la bande-annonce VF d'abord ; jamais l'interview, la featurette ni la réaction, même typées « Trailer »", () => {
    const videos = [
      yt("interview", "Dune : Interview de Zendaya", "Trailer", "fr"),
      yt("feat", "Dune : la musique de Hans Zimmer", "Featurette", "fr"),
      yt("reaction", "Dune Trailer Reaction", "Trailer", "en"),
      yt("vo", "Dune | Official Main Trailer", "Trailer", "en"),
      yt("teaser", "Dune - Teaser VF", "Teaser", "fr"),
      yt("vf2", "Dune - Bande-annonce 2 VF", "Trailer", "fr"),
      yt("vf", "Dune - Bande-annonce VF", "Trailer", "fr"),
      yt("vost", "Dune - Bande-annonce VOST", "Trailer", "fr"),
    ];
    expect(names(videos, ["Dune"])).toEqual([
      "Dune - Bande-annonce VF", "Dune - Bande-annonce 2 VF", "Dune - Bande-annonce VOST", "Dune - Teaser VF", "Dune | Official Main Trailer",
    ]);
  });

  it("la vidéo d'un HOMONYME glissée dans la liste est écartée ; le titre lui-même ne passe pas pour un bonus", () => {
    const videos = [
      yt("other", "Shameless (UK) | Bande-annonce VF", "Trailer", "fr"),
      yt("own", "The Interview - Official Trailer", "Trailer", "en"),
    ];
    expect(names(videos, ["The Interview", "L'Interview qui tue !"])).toEqual(["The Interview - Official Trailer"]);
  });

  it("rien de juste : rien — une liste de bonus ne donne aucune entrée", () => {
    const videos = [yt("a", "Dune : Behind the Scenes", "Behind the Scenes"), yt("b", "Dune - Bloopers", "Bloopers"), yt("c", "Dune - Extrait VF", "Clip", "fr")];
    expect(names(videos, ["Dune"])).toEqual([]);
  });
});
