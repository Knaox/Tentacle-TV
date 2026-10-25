/**
 * La règle d'adresse des pochettes (`components/artworkSrc.ts`) et la musique
 * gardée : une image de l'appareil (`tentacle://local/…`) passe telle quelle,
 * sans jeton ; un chemin du serveur reçoit toujours le sien ; un autre hôte, jamais.
 */

import { describe, expect, it } from "vitest";
import { artworkSrcOf } from "../components/artworkSrc";

const AUTH = { baseUrl: "http://serveur.test", token: "jeton", useCredentials: false };

describe("artworkSrcOf et les pochettes gardées", () => {
  it("une pochette de l'appareil, telle quelle et sans jeton", () => {
    expect(artworkSrcOf("tentacle://local/media/a/cover.jpg?t=local", AUTH)).toBe("tentacle://local/media/a/cover.jpg?t=local");
  });

  it("le serveur reçoit son jeton, un autre hôte jamais", () => {
    expect(artworkSrcOf("/api/music/artwork/a", AUTH)).toBe("http://serveur.test/api/music/artwork/a?api_key=jeton");
    expect(artworkSrcOf("https://ailleurs.test/a.jpg", AUTH)).toBe("https://ailleurs.test/a.jpg");
  });
});
