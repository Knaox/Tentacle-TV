/**
 * Un masquage qui laisse passer est pire qu'aucun masquage : il donne
 * l'impression que le journal est propre. Ces cas sont donc tirés des formes
 * RÉELLES que prennent les URL de ce projet, pas d'exemples inventés.
 */

import { describe, expect, it } from "vitest";
import { masquerSecrets } from "./redaction";

describe("jeton en parametre d'URL", () => {
  it("masque api_key sous ses deux casses", () => {
    // Forme produite par `usePlaybackInfo.ts` et par le serveur Jellyfin.
    const direct = "loadfile http://jf.local/Videos/42/stream?Static=true&api_key=05ddc30dSECRET";
    expect(masquerSecrets(direct)).toBe(
      "loadfile http://jf.local/Videos/42/stream?Static=true&api_key=***",
    );
    const transcode = "http://jf.local/videos/42/main.m3u8?ApiKey=05ddc30dSECRET&Static=false";
    // Le paramètre SUIVANT doit survivre : masquer jusqu'à la fin effacerait
    // l'information utile au diagnostic.
    expect(masquerSecrets(transcode)).toBe(
      "http://jf.local/videos/42/main.m3u8?ApiKey=***&Static=false",
    );
  });

  it("masque le premier parametre comme les suivants", () => {
    const url = "http://jf.local/x?api_key=SECRET";
    expect(masquerSecrets(url)).not.toContain("SECRET");
  });

  it("masque la forme trickplay", () => {
    // `useTrickplay.ts` pose `api_key` derrière `mediaSourceId`.
    const url = "meta/1/trickplay/320/4.jpg?mediaSourceId=ms1&api_key=SECRET";
    const sortie = masquerSecrets(url);
    expect(sortie).not.toContain("SECRET");
    expect(sortie).toContain("mediaSourceId=ms1");
  });
});

describe("jeton en en-tete", () => {
  it("masque X-Emby-Token", () => {
    expect(masquerSecrets("headers X-Emby-Token: abc123def")).toBe("headers X-Emby-Token: ***");
  });

  it("masque un Bearer, avec ou sans en-tete", () => {
    expect(masquerSecrets("Authorization: Bearer eyJhbGciOi")).toBe("Authorization: ***");
    expect(masquerSecrets("echec avec Bearer eyJhbGciOi sur /api/downloads")).toBe(
      "echec avec Bearer *** sur /api/downloads",
    );
  });
});

describe("ce qui ne doit PAS etre masque", () => {
  it("laisse les identifiants et les messages ordinaires intacts", () => {
    // Un masquage par entropie effacerait ces identifiants Jellyfin et rendrait
    // les journaux inutilisables. On ne masque que ce qui est nommement secret.
    const message =
      "downloads_enqueue a echoue : item a1b2c3d4e5f6 introuvable sur http://jf.local/Items/a1b2c3d4e5f6";
    expect(masquerSecrets(message)).toBe(message);
  });

  it("laisse mediaSourceId et playSessionId", () => {
    const url = "/Videos/ActiveEncodings?deviceId=dev-1&playSessionId=ps-9";
    expect(masquerSecrets(url)).toBe(url);
  });
});

describe("cas degeneres", () => {
  it("supporte plusieurs secrets dans le meme message", () => {
    const message = "a?api_key=UN puis b?ApiKey=DEUX puis Bearer TROIS";
    const sortie = masquerSecrets(message);
    for (const secret of ["UN", "DEUX", "TROIS"]) expect(sortie).not.toContain(secret);
  });

  it("ne casse pas sur une chaine vide", () => {
    expect(masquerSecrets("")).toBe("");
  });
});
