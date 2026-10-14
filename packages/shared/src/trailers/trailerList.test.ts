import { describe, expect, it } from "vitest";
import {
  hasSubtitleMark, trailerLangMatches, mergeTrailers, parseYouTubeId, sortTrailersByLang, trailerKind, trailerLangFit,
  type RichTrailer,
} from "./trailerList";

const video = (Name: string, lang?: string, type?: string): RichTrailer => ({ Url: `https://youtu.be/${Name}`, Name, lang, type });

describe("bandes-annonces › la langue d'une vidéo", () => {
  it("une VF étiquetée `fr`, ou dite par son libellé, est doublée", () => {
    expect(trailerLangFit(video("Dune : Bande-annonce officielle", "fr"), "fr")).toBe("dubbed");
    expect(trailerLangFit(video("Dune - Bande-annonce VF"), "fr-FR")).toBe("dubbed");
    expect(trailerLangFit(video("Dune — Version française"), "fr")).toBe("dubbed");
    expect(trailerLangMatches(video("Dune - Bande-annonce VF"), "fr")).toBe(true);
  });

  it("le libellé passe avant le code : une VOST étiquetée `fr` est sous-titrée, jamais une VF", () => {
    for (const name of ["Bande-annonce VOST", "Bande-annonce VOSTFR", "Rick et Morty - saison 9 Bande-annonce VO STFR", "Trailer (V.O. ST-FR)", "Bande-annonce sous-titrée"]) {
      expect(trailerLangFit(video(name, "fr"), "fr")).toBe("subtitled");
      expect(trailerLangMatches(video(name, "fr"), "fr")).toBe(false);
    }
  });

  it("une VO, même étiquetée `fr`, n'est ni doublée ni sous-titrée", () => {
    for (const name of ["Bande-annonce VO", "Teaser V.O.", "Bande-annonce (version originale)"]) {
      expect(trailerLangFit(video(name, "fr"), "fr")).toBe("other");
    }
  });

  it("les marques de mots seulement : « vo » au milieu d'un mot ne compte pas", () => {
    expect(trailerLangFit(video("Le Voyage - Bande-annonce", "fr"), "fr")).toBe("dubbed");
    expect(trailerLangFit(video("Vostok - Bande-annonce", "fr"), "fr")).toBe("dubbed");
    expect(trailerLangFit(video("Dévoilement officiel", "fr"), "fr")).toBe("dubbed");
  });

  it("la langue du serveur décide : en anglais, une VOSTFR n'est rien de plus qu'une autre", () => {
    expect(trailerLangFit(video("Official Trailer", "en"), "en")).toBe("dubbed");
    expect(trailerLangFit(video("Bande-annonce VOSTFR", "fr"), "en")).toBe("other");
    expect(trailerLangFit(video("Bande-annonce VF", "fr"), "en")).toBe("other");
    expect(trailerLangFit(video("Official Trailer"), "en")).toBe("dubbed");
    expect(trailerLangFit(video("Trailer subtitled", "en"), "en")).toBe("subtitled");
  });

  it("sans langue visée, rien n'est préféré", () => {
    expect(trailerLangFit(video("Bande-annonce VF", "fr"), undefined)).toBe("other");
  });

  it("repère les marques de sous-titres", () => {
    expect(hasSubtitleMark("Bande-annonce VOSTFR")).toBe(true);
    expect(hasSubtitleMark("Saison 9 VO STFR")).toBe(true);
    expect(hasSubtitleMark("Bande-annonce VF")).toBe(false);
  });
});

describe("bandes-annonces › le type d'une vidéo", () => {
  it("le type TMDB fait foi pour une bande-annonce ou un teaser", () => {
    expect(trailerKind(video("x", "fr", "Trailer"))).toBe("trailer");
    expect(trailerKind(video("x", "fr", "Teaser"))).toBe("teaser");
  });

  it("un Clip ou une Featurette dont le libellé dit « bande-annonce » en est une", () => {
    expect(trailerKind(video("Dune Bande-annonce VF", "fr", "Clip"))).toBe("trailer");
    expect(trailerKind(video("Dune Teaser VF", "fr", "Featurette"))).toBe("teaser");
    expect(trailerKind(video("Dune : la musique", "fr", "Featurette"))).toBe("other");
    expect(trailerKind(video("Extrait de la bande-annonce", "fr", "Clip"))).toBe("other");
  });

  it("sans type (Jellyfin), le libellé seul ; sans mot-clé, une bande-annonce", () => {
    expect(trailerKind(video("Making-of"))).toBe("other");
    expect(trailerKind(video("Teaser"))).toBe("teaser");
    expect(trailerKind(video("Dune"))).toBe("trailer");
  });
});

describe("bandes-annonces › l'ordre", () => {
  it("VF, puis VOSTFR, puis le reste ; à langue égale, une bande-annonce avant un teaser", () => {
    const list = [
      video("enTrailer", "en", "Trailer"),
      video("Bande-annonce VOST", "fr", "Trailer"),
      video("Teaser VF", "fr", "Teaser"),
      video("Bande-annonce VF", "fr", "Trailer"),
      video("Bande-annonce VO", "fr", "Trailer"),
    ];
    expect(sortTrailersByLang(list, "fr").map((t) => t.Name)).toEqual([
      "Bande-annonce VF", "Teaser VF", "Bande-annonce VOST", "enTrailer", "Bande-annonce VO",
    ]);
  });

  it("serveur en anglais : la VO anglaise d'abord", () => {
    const list = [video("Bande-annonce VF", "fr", "Trailer"), video("Official Trailer", "en", "Trailer")];
    expect(sortTrailersByLang(list, "en").map((t) => t.Name)).toEqual(["Official Trailer", "Bande-annonce VF"]);
  });

  it("fusionne Jellyfin et TMDB par vidéo, TMDB primant", () => {
    const merged = mergeTrailers(
      [{ Url: "https://www.youtube.com/watch?v=aaaaaaaaaaa", Name: "Trailer" }],
      [{ key: "aaaaaaaaaaa", name: "Bande-annonce VF", type: "Trailer", lang: "fr", url: "https://www.youtube.com/watch?v=aaaaaaaaaaa" }],
      "fr",
    );
    expect(merged).toEqual([{ Url: "https://www.youtube.com/watch?v=aaaaaaaaaaa", Name: "Bande-annonce VF", type: "Trailer", lang: "fr" }]);
    expect(parseYouTubeId(merged[0].Url)).toBe("aaaaaaaaaaa");
  });
});
