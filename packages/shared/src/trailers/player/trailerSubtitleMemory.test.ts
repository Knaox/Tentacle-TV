import { describe, expect, it } from "vitest";
import { trailerRememberedSubtitle, trailerStartSubtitle, trailerSubtitleKey, trailerSubtitleMemoryOf } from "./trailerSubtitleMemory";

const tracks = [{ lang: "en" }, { lang: "fr-CA" }, { lang: "pt-BR" }];

describe("sous-titre retenu d'une bande-annonce à l'autre", () => {
  it("sans choix retenu, ou « Désactivés » : aucun sous-titre", () => {
    expect(trailerRememberedSubtitle(tracks, null)).toBeNull();
    expect(trailerRememberedSubtitle(tracks, trailerSubtitleMemoryOf("off"))).toBeNull();
  });

  it("la même langue, quand elle est offerte", () => {
    expect(trailerRememberedSubtitle(tracks, "en")).toBe("en");
    expect(trailerRememberedSubtitle(tracks, "FR-ca")).toBe("fr-CA");
  });

  it("sinon la même langue de base", () => {
    expect(trailerRememberedSubtitle(tracks, "fr")).toBe("fr-CA");
    expect(trailerRememberedSubtitle(tracks, "pt-PT")).toBe("pt-BR");
  });

  it("une langue absente : rien, jamais une autre", () => {
    expect(trailerRememberedSubtitle(tracks, "de")).toBeNull();
    expect(trailerRememberedSubtitle([], "en")).toBeNull();
  });
});

describe("rangé par profil", () => {
  it("une clé par compte : chaque profil de la Famille garde le sien", () => {
    expect(trailerSubtitleKey("u1")).toBe("tentacle_trailer_subtitle:u1");
    expect(trailerSubtitleKey("u1")).not.toBe(trailerSubtitleKey("u2"));
  });
});

describe("sous-titre au lancement (web, bureau)", () => {
  const offered = [{ lang: "en", auto: false }, { lang: "fr", auto: false }, { lang: "en", auto: true }];

  it("sans choix retenu, la piste posée dans la langue du serveur", () => {
    expect(trailerStartSubtitle(offered, null, { language: "fr-FR", version: "original" })).toBe("fr");
    expect(trailerStartSubtitle(offered, null, { language: "fr-FR" })).toBe("fr");
  });

  it("rien pour une bande-annonce déjà dans cette langue, ni sans langue connue", () => {
    expect(trailerStartSubtitle(offered, null, { language: "fr", version: "localized" })).toBeNull();
    expect(trailerStartSubtitle(offered, null, { language: null })).toBeNull();
  });

  it("jamais la reconnaissance vocale", () => {
    expect(trailerStartSubtitle([{ lang: "fr", auto: true }], null, { language: "fr", version: "original" })).toBeNull();
  });

  it("un choix retenu l'emporte, « Désactivés » compris", () => {
    expect(trailerStartSubtitle(offered, "off", { language: "fr" })).toBeNull();
    expect(trailerStartSubtitle(offered, "en", { language: "fr" })).toBe("en");
  });
});
