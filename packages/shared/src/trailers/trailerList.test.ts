import { describe, expect, it } from "vitest";
import {
  hasSubtitleMark, trailerLangMatches, mergeTrailers, parseYouTubeId, sortTrailersByLang, trailerKind, trailerLangFit,
  trailerOrdinal, type RichTrailer,
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

  it("un mot de bonus l'emporte sur le type TMDB : interview, réaction, critique, coulisses… jamais une bande-annonce", () => {
    for (const name of [
      "Dune : Interview de Timothée Chalamet", "Dune Official Trailer Reaction", "Dune - Critique", "Behind the Scene",
      "Dune : Les coulisses du tournage", "Dune | Q&A with Denis Villeneuve", "Dune - Recap", "Dune Concept Trailer (Fan Made)",
      "Dune : conférence de presse", "Dune : scènes coupées", "Dune - Bêtisier", "Honest Trailers | Dune",
    ]) {
      expect(trailerKind(video(name, "fr", "Trailer"))).toBe("other");
    }
  });

  it("le libellé « teaser » l'emporte sur le type TMDB « Trailer » (Barbie : « Teaser Officiel [VF] »)", () => {
    expect(trailerKind(video("Barbie - Teaser Officiel [VF]", "fr", "Trailer"))).toBe("teaser");
    expect(trailerKind(video("Barbie - Teaser Officiel 2 [VF]", "fr", "Trailer"))).toBe("teaser");
    expect(trailerKind(video("Barbie - Bande-annonce Officielle [VF]", "fr", "Trailer"))).toBe("trailer");
  });

  it("le nom du titre ne compte pas comme un mot de bonus : « The Interview » a sa bande-annonce", () => {
    expect(trailerKind(video("The Interview - Official Trailer", "en", "Trailer"), ["The Interview"])).toBe("trailer");
    expect(trailerKind(video("The Interview - Official Trailer", "en", "Trailer"))).toBe("other");
    expect(trailerKind(video("The Interview - Cast Interview", "en", "Trailer"), ["The Interview"])).toBe("other");
  });

  it("sans type (Jellyfin), le libellé seul ; sans mot-clé, une bande-annonce", () => {
    expect(trailerKind(video("Making-of"))).toBe("other");
    expect(trailerKind(video("Teaser"))).toBe("teaser");
    expect(trailerKind(video("Dune"))).toBe("trailer");
  });
});

describe("bandes-annonces › l'ordre", () => {
  it("dans la langue visée, toutes les bandes-annonces avant les teasers, la VF avant la VOSTFR ; puis le reste", () => {
    const list = [
      video("enTrailer", "en", "Trailer"),
      video("Bande-annonce VOST", "fr", "Trailer"),
      video("Teaser VF", "fr", "Teaser"),
      video("Bande-annonce VF", "fr", "Trailer"),
      video("Bande-annonce VO", "fr", "Trailer"),
      video("enTeaser", "en", "Teaser"),
    ];
    expect(sortTrailersByLang(list, "fr").map((t) => t.Name)).toEqual([
      "Bande-annonce VF", "Bande-annonce VOST", "Teaser VF", "enTrailer", "Bande-annonce VO", "enTeaser",
    ]);
  });

  it("la bande-annonce 1 avant la 2 ; un numéro de saison n'est pas un rang", () => {
    expect(trailerOrdinal("Dune : Bande-annonce 2 VF")).toBe(2);
    expect(trailerOrdinal("Dune Bande-annonce (2) VF")).toBe(2);
    expect(trailerOrdinal("Official Trailer #3")).toBe(3);
    expect(trailerOrdinal("Season 2 Official Trailer")).toBe(1);
    expect(trailerOrdinal("Trailer 2024")).toBe(1);
    expect(trailerOrdinal("Final Trailer")).toBeGreaterThan(3);
    const list = [video("Bande-annonce 2 VF", "fr", "Trailer"), video("Bande-annonce VF", "fr", "Trailer")];
    expect(sortTrailersByLang(list, "fr").map((t) => t.Name)).toEqual(["Bande-annonce VF", "Bande-annonce 2 VF"]);
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

  it("la fusion écarte les bonus : interviews, featurettes, extraits — de Jellyfin comme de TMDB", () => {
    const merged = mergeTrailers(
      [{ Url: "https://www.youtube.com/watch?v=bbbbbbbbbbb", Name: "Interview du réalisateur" }],
      [
        { key: "ccccccccccc", name: "Dune : la musique", type: "Featurette", lang: "fr", url: "https://www.youtube.com/watch?v=ccccccccccc" },
        { key: "ddddddddddd", name: "Official Trailer", type: "Trailer", lang: "en", url: "https://www.youtube.com/watch?v=ddddddddddd" },
      ],
      "fr",
    );
    expect(merged.map((t) => t.Name)).toEqual(["Official Trailer"]);
  });
});
