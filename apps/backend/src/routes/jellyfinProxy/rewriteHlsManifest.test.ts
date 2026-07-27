/**
 * Cette fonction écrit le jeton de session du client dans un document fourni
 * par le serveur Jellyfin — dont l'adresse est saisie par l'utilisateur. Elle
 * est donc à la frontière exacte du modèle de menace « serveur Jellyfin
 * hostile » : ce qu'elle décide de décorer, le lecteur ira le chercher, jeton
 * compris.
 *
 * Les manifestes ci-dessous ont la forme de ceux que Jellyfin produit.
 */

import { describe, expect, it } from "vitest";
import { rewriteHlsManifest } from "./rewriteHlsManifest";

const JETON = "jeton-de-session-abc123";

describe("URL relatives : le jeton est ajoute", () => {
  it("decore une sous-playlist et des segments", () => {
    const manifeste = [
      "#EXTM3U",
      "#EXT-X-VERSION:3",
      "#EXT-X-STREAM-INF:BANDWIDTH=4000000",
      "main.m3u8?MediaSourceId=ms1",
      "hls1/main/0.ts",
    ].join("\n");
    const sortie = rewriteHlsManifest(manifeste, JETON);
    expect(sortie).toContain(`main.m3u8?MediaSourceId=ms1&api_key=${JETON}`);
    expect(sortie).toContain(`hls1/main/0.ts?api_key=${JETON}`);
    // Les tags de metadonnee restent intacts.
    expect(sortie).toContain("#EXT-X-STREAM-INF:BANDWIDTH=4000000");
  });

  it("decore les URI des tags", () => {
    const manifeste =
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",NAME="Francais",URI="audio/1.m3u8"';
    expect(rewriteHlsManifest(manifeste, JETON)).toContain(`URI="audio/1.m3u8?api_key=${JETON}"`);
  });

  it("decore un chemin absolu, qui reste sur notre proxy", () => {
    // `/hls1/…` n'est PAS une URL absolue : elle garde l'origine du manifeste.
    expect(rewriteHlsManifest("/hls1/main/2.ts", JETON)).toBe(`/hls1/main/2.ts?api_key=${JETON}`);
  });

  it("n'ajoute pas un second jeton", () => {
    const deja = "main.m3u8?api_key=DEJA_LA";
    expect(rewriteHlsManifest(deja, JETON)).toBe(deja);
    expect(rewriteHlsManifest("main.m3u8?ApiKey=DEJA_LA", JETON)).toBe("main.m3u8?ApiKey=DEJA_LA");
  });
});

describe("URL absolues : le jeton n'est JAMAIS ajoute", () => {
  it("refuse de decorer un hote tiers", () => {
    // Le coeur du probleme : un serveur Jellyfin hostile ou compromis renvoie
    // un manifeste pointant chez lui, et le lecteur y porterait le jeton.
    const manifeste = [
      "#EXTM3U",
      "https://pirate.exemple/segment.ts",
      "http://pirate.exemple/autre.ts",
      "//pirate.exemple/protocole-relative.ts",
    ].join("\n");
    const sortie = rewriteHlsManifest(manifeste, JETON);
    expect(sortie).not.toContain(JETON);
    expect(sortie).toContain("https://pirate.exemple/segment.ts");
  });

  it("refuse aussi dans les URI des tags", () => {
    const manifeste = '#EXT-X-MEDIA:TYPE=SUBTITLES,URI="https://pirate.exemple/sub.m3u8"';
    expect(rewriteHlsManifest(manifeste, JETON)).not.toContain(JETON);
  });

  it("refuse un schema exotique", () => {
    for (const url of ["data:text/plain,x", "ftp://pirate/x.ts", "custom-scheme:x"]) {
      expect(rewriteHlsManifest(url, JETON), url).not.toContain(JETON);
    }
  });

  it("ne se laisse pas berner par des espaces en tete", () => {
    expect(rewriteHlsManifest("   https://pirate.exemple/x.ts", JETON)).not.toContain(JETON);
  });

  it("laisse passer le relatif quand les deux se cotoient", () => {
    const manifeste = ["hls1/ok.ts", "https://pirate.exemple/ko.ts"].join("\n");
    const sortie = rewriteHlsManifest(manifeste, JETON);
    expect(sortie).toContain(`hls1/ok.ts?api_key=${JETON}`);
    expect(sortie).toContain("https://pirate.exemple/ko.ts\n".trim());
    expect(sortie.split("\n")[1]).toBe("https://pirate.exemple/ko.ts");
  });
});

describe("forme du document", () => {
  it("conserve le nombre de lignes et les lignes vides", () => {
    const manifeste = "#EXTM3U\n\nhls1/0.ts\n";
    const sortie = rewriteHlsManifest(manifeste, JETON);
    expect(sortie.split("\n").length).toBe(manifeste.split("\n").length);
  });

  it("encode le jeton", () => {
    const sortie = rewriteHlsManifest("hls1/0.ts", "a b&c=d");
    expect(sortie).toBe("hls1/0.ts?api_key=a%20b%26c%3Dd");
  });
});
