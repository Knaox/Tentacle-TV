import { describe, expect, it } from "vitest";
import { trailerRememberedSubtitle, trailerSubtitleMemoryOf } from "./trailerSubtitleMemory";

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
