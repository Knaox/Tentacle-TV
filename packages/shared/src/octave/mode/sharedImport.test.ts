import { describe, expect, it } from "vitest";
import { SHARED_IMPORT_TEXT_MAX, sharedImportLink } from "./sharedImport";

describe("sharedImportLink : le lien de playlist d'un texte partagé", () => {
  it("prend un lien nu (Spotify, Apple Music, YouTube Music)", () => {
    expect(sharedImportLink("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123")).toBe("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123");
    expect(sharedImportLink("https://music.apple.com/fr/playlist/chill/pl.u-abcdef12345")).toBe("https://music.apple.com/fr/playlist/chill/pl.u-abcdef12345");
    expect(sharedImportLink("https://music.youtube.com/playlist?list=PLabcdefghijk123")).toBe("https://music.youtube.com/playlist?list=PLabcdefghijk123");
  });

  it("trouve le lien DANS une phrase (Deezer, lien court) et retire la ponctuation qui le suit", () => {
    expect(sharedImportLink("Écoute Mes favoris sur Deezer : https://link.deezer.com/s/30aBcD1eF.")).toBe("https://link.deezer.com/s/30aBcD1eF");
    expect(sharedImportLink("Ma playlist (https://www.deezer.com/fr/playlist/1234567)")).toBe("https://www.deezer.com/fr/playlist/1234567");
  });

  it("passe un premier lien inconnu pour le suivant reconnu", () => {
    expect(sharedImportLink("Vu sur https://exemple.fr/blog puis https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy")).toBe("https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy");
  });

  it("reconnaît le lien de partage d'un autre Tentacle", () => {
    expect(sharedImportLink("https://ami.fr/octave/share/AbCdEfGhIjKlMnOpQrStUv")).toBe("https://ami.fr/octave/share/AbCdEfGhIjKlMnOpQrStUv");
  });

  it("rien sans lien reconnu, ni pour un texte vide", () => {
    expect(sharedImportLink("Salut, écoute ça ce soir !")).toBeNull();
    expect(sharedImportLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(sharedImportLink("")).toBeNull();
    expect(sharedImportLink(null)).toBeNull();
  });

  it("ne lit pas au-delà de la borne", () => {
    expect(sharedImportLink(`${"a".repeat(SHARED_IMPORT_TEXT_MAX)} https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M`)).toBeNull();
  });
});
