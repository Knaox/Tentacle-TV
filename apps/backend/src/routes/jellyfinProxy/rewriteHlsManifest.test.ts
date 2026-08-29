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

const TOKEN = "jeton-de-session-abc123";

describe("URL relatives : le jeton est ajoute", () => {
  it("decore une sous-playlist et des segments", () => {
    const manifest = [
      "#EXTM3U",
      "#EXT-X-VERSION:3",
      "#EXT-X-STREAM-INF:BANDWIDTH=4000000",
      "main.m3u8?MediaSourceId=ms1",
      "hls1/main/0.ts",
    ].join("\n");
    const out = rewriteHlsManifest(manifest, TOKEN);
    expect(out).toContain(`main.m3u8?MediaSourceId=ms1&api_key=${TOKEN}`);
    expect(out).toContain(`hls1/main/0.ts?api_key=${TOKEN}`);
    // Les tags de metadonnee restent intacts.
    expect(out).toContain("#EXT-X-STREAM-INF:BANDWIDTH=4000000");
  });

  it("decore les URI des tags", () => {
    const manifest =
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",NAME="Francais",URI="audio/1.m3u8"';
    expect(rewriteHlsManifest(manifest, TOKEN)).toContain(`URI="audio/1.m3u8?api_key=${TOKEN}"`);
  });

  it("decore un chemin absolu, qui reste sur notre proxy", () => {
    // `/hls1/…` n'est PAS une URL absolue : elle garde l'origine du manifeste.
    expect(rewriteHlsManifest("/hls1/main/2.ts", TOKEN)).toBe(`/hls1/main/2.ts?api_key=${TOKEN}`);
  });

  it("n'ajoute pas un second jeton", () => {
    const already = "main.m3u8?api_key=DEJA_LA";
    expect(rewriteHlsManifest(already, TOKEN)).toBe(already);
    expect(rewriteHlsManifest("main.m3u8?ApiKey=DEJA_LA", TOKEN)).toBe("main.m3u8?ApiKey=DEJA_LA");
  });
});

describe("URL absolues : le jeton n'est JAMAIS ajoute", () => {
  it("refuse de decorer un hote tiers", () => {
    // Le coeur du probleme : un serveur Jellyfin hostile ou compromis renvoie
    // un manifeste pointant chez lui, et le lecteur y porterait le jeton.
    const manifest = [
      "#EXTM3U",
      "https://pirate.exemple/segment.ts",
      "http://pirate.exemple/autre.ts",
      "//pirate.exemple/protocole-relative.ts",
    ].join("\n");
    const out = rewriteHlsManifest(manifest, TOKEN);
    expect(out).not.toContain(TOKEN);
    expect(out).toContain("https://pirate.exemple/segment.ts");
  });

  it("refuse aussi dans les URI des tags", () => {
    const manifest = '#EXT-X-MEDIA:TYPE=SUBTITLES,URI="https://pirate.exemple/sub.m3u8"';
    expect(rewriteHlsManifest(manifest, TOKEN)).not.toContain(TOKEN);
  });

  it("refuse un schema exotique", () => {
    for (const url of ["data:text/plain,x", "ftp://pirate/x.ts", "custom-scheme:x"]) {
      expect(rewriteHlsManifest(url, TOKEN), url).not.toContain(TOKEN);
    }
  });

  it("ne se laisse pas berner par des espaces en tete", () => {
    expect(rewriteHlsManifest("   https://pirate.exemple/x.ts", TOKEN)).not.toContain(TOKEN);
  });

  it("laisse passer le relatif quand les deux se cotoient", () => {
    const manifest = ["hls1/ok.ts", "https://pirate.exemple/ko.ts"].join("\n");
    const out = rewriteHlsManifest(manifest, TOKEN);
    expect(out).toContain(`hls1/ok.ts?api_key=${TOKEN}`);
    expect(out).toContain("https://pirate.exemple/ko.ts\n".trim());
    expect(out.split("\n")[1]).toBe("https://pirate.exemple/ko.ts");
  });
});

describe("forme du document", () => {
  it("conserve le nombre de lignes et les lignes vides", () => {
    const manifest = "#EXTM3U\n\nhls1/0.ts\n";
    const out = rewriteHlsManifest(manifest, TOKEN);
    expect(out.split("\n").length).toBe(manifest.split("\n").length);
  });

  it("encode le jeton", () => {
    const out = rewriteHlsManifest("hls1/0.ts", "a b&c=d");
    expect(out).toBe("hls1/0.ts?api_key=a%20b%26c%3Dd");
  });
});
