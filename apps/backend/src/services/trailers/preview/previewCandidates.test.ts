import { describe, expect, it } from "vitest";
import type { TmdbVideo } from "../../../trailers/trailerList";
import { previewCandidates as rankedCandidates } from "./previewCandidates";

const previewCandidates = (...args: Parameters<typeof rankedCandidates>) => rankedCandidates(...args).map((c) => c.ytId);

const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`;
const tmdb = (key: string, type: string, lang?: string, name = key): TmdbVideo => ({ key, name, type, site: "YouTube", lang, url: yt(key) });

describe("candidates d'un aperçu", () => {
  it("la langue de l'interface d'abord (la VF en français), puis les bandes-annonces avant les teasers", () => {
    const videos = [
      tmdb("enTeaser001", "Teaser", "en"),
      tmdb("enTrailer01", "Trailer", "en"),
      tmdb("frTeaser001", "Teaser", "fr"),
      tmdb("frTrailer01", "Trailer", "fr"),
    ];
    expect(previewCandidates([], videos, "fr")).toEqual(["frTrailer01", "frTeaser001", "enTrailer01", "enTeaser001"]);
    expect(previewCandidates([], videos, "en")).toEqual(["enTrailer01", "enTeaser001", "frTrailer01", "frTeaser001"]);
    // Sans langue : l'ordre des types seul.
    expect(previewCandidates([], videos, undefined)).toEqual(["enTrailer01", "frTrailer01", "enTeaser001", "frTeaser001"]);
  });

  it("jamais une featurette, des coulisses, un extrait — typés par TMDB ou dits par le libellé de Jellyfin", () => {
    const jellyfin = [
      { Url: yt("jfTrailer01"), Name: "Bande-annonce VF" },
      { Url: yt("jfFeature01"), Name: "Featurette : la musique" },
      { Url: yt("jfMaking001"), Name: "Making-of" },
    ];
    const videos = [tmdb("tmFeature01", "Featurette", "fr"), tmdb("tmBehind001", "Behind the Scenes", "fr"), tmdb("tmClip00001", "Clip", "fr")];
    expect(previewCandidates(jellyfin, videos, "fr")).toEqual(["jfTrailer01"]);
  });

  it("une VOST étiquetée `fr` passe après une VF, même teaser ; un Clip qui se dit bande-annonce reste candidat", () => {
    const videos = [
      tmdb("vostTrail01", "Trailer", "fr", "Bande-annonce VOST"),
      tmdb("vfTeaser001", "Teaser", "fr", "Teaser VF"),
      tmdb("vfClipBA001", "Clip", "fr", "Bande-annonce VF (2)"),
      tmdb("voTrailer01", "Trailer", "fr", "Bande-annonce VO"),
    ];
    expect(previewCandidates([], videos, "fr")).toEqual(["vfClipBA001", "vfTeaser001", "vostTrail01", "voTrailer01"]);
  });

  it("chaque candidate porte son rang de langue : la VF 0, la VOST 1, le reste 2", () => {
    const videos = [tmdb("vfTrailer01", "Trailer", "fr", "Bande-annonce VF"), tmdb("vostTrail01", "Trailer", "fr", "Bande-annonce VOST"), tmdb("enTrailer01", "Trailer", "en")];
    expect(rankedCandidates([], videos, "fr")).toEqual([
      { ytId: "vfTrailer01", langRank: 0 }, { ytId: "vostTrail01", langRank: 1 }, { ytId: "enTrailer01", langRank: 2 },
    ]);
  });

  it("YouTube seulement, une vidéo une fois — TMDB et Jellyfin fusionnés par identifiant", () => {
    const jellyfin = [
      { Url: "https://vimeo.com/12345", Name: "Trailer" },
      { Url: "plugin://plugin.video.youtube/play/?video_id=sameVideo01", Name: "Trailer" },
      { Url: yt("sameVideo01") },
    ];
    expect(previewCandidates(jellyfin, [tmdb("sameVideo01", "Trailer", "en")], "fr")).toEqual(["sameVideo01"]);
  });

  it("rien à proposer : une liste vide", () => {
    expect(previewCandidates([], [], "fr")).toEqual([]);
    expect(previewCandidates([], [tmdb("onlyClip001", "Clip", "fr")], "fr")).toEqual([]);
  });
});
