/**
 * Premiers tests du backend.
 *
 * Ils portent sur ce qui ne se voit pas : une clé admin qui repart dans une
 * réponse ne casse rien, n'affiche rien, et ne se remarque que le jour où
 * quelqu'un lit l'URL d'une vidéo. Le seul moyen de savoir que le nettoyage
 * tient est de le lui demander.
 *
 * Les corps sont ceux que Jellyfin renvoie réellement pour un `PlaybackInfo`,
 * réduits aux champs qui comptent.
 */

import { describe, expect, it } from "vitest";
import { porteUneUrlDeLecture, scrubAdminKey } from "./scrubAdminKey";

/** 32 hexadécimaux, la forme d'une clé d'API Jellyfin. */
const CLE_ADMIN = "05ddc30d1f4b4a8fa2c9e7b6d3841fae";
const JETON_CLIENT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.client";

function playbackInfo(cle: string): string {
  return JSON.stringify({
    MediaSources: [
      {
        Id: "ms1",
        SupportsDirectPlay: false,
        SupportsTranscoding: true,
        TranscodingUrl:
          `/videos/42/main.m3u8?DeviceId=dev1&MediaSourceId=ms1&api_key=${cle}` +
          "&VideoCodec=h264&AudioCodec=aac&TranscodingMaxAudioChannels=2",
      },
    ],
    PlaySessionId: "ps-9",
  });
}

describe("routes dont la reponse est relue", () => {
  it("reconnait les deux formes de PlaybackInfo", () => {
    // Les deux sont autorisées par `patterns.ts`.
    expect(porteUneUrlDeLecture("Videos/42/PlaybackInfo")).toBe(true);
    expect(porteUneUrlDeLecture("Items/42/PlaybackInfo")).toBe(true);
  });

  it("ne relit ni le catalogue ni les flux", () => {
    // Bufferiser ceux-là ferait payer une copie mémoire à chaque appel, et des
    // gigaoctets pour un flux.
    for (const path of [
      "Items",
      "Items/42",
      "Users/u1/Items",
      "Videos/42/stream",
      "Videos/42/ms1/master.m3u8",
      "hls1/main/3.ts",
      "Shows/NextUp",
    ]) {
      expect(porteUneUrlDeLecture(path), path).toBe(false);
    }
  });

  it("ne se laisse pas berner par un chemin qui contient le mot", () => {
    expect(porteUneUrlDeLecture("Items/PlaybackInfoBis")).toBe(false);
    expect(porteUneUrlDeLecture("PlaybackInfoOther/42")).toBe(false);
  });
});

describe("nettoyage de la cle admin", () => {
  it("remplace la cle par le jeton du client dans le TranscodingUrl", () => {
    const { corps, remplacements } = scrubAdminKey(playbackInfo(CLE_ADMIN), CLE_ADMIN, JETON_CLIENT);
    expect(remplacements).toBe(1);
    expect(corps).not.toContain(CLE_ADMIN);
    expect(corps).toContain(`api_key=${JETON_CLIENT}`);
    // Le reste de l'URL doit survivre : c'est elle qui pilote le transcodage.
    expect(corps).toContain("VideoCodec=h264");
    expect(corps).toContain("MediaSourceId=ms1");
    // Et le JSON doit rester du JSON.
    expect(() => JSON.parse(corps) as unknown).not.toThrow();
  });

  it("remplace TOUTES les occurrences", () => {
    // Jellyfin recopie parfois l'URL dans plusieurs sources média.
    const deux = JSON.stringify({
      MediaSources: [
        { TranscodingUrl: `/a?api_key=${CLE_ADMIN}` },
        { TranscodingUrl: `/b?api_key=${CLE_ADMIN}` },
      ],
    });
    const { corps, remplacements } = scrubAdminKey(deux, CLE_ADMIN, JETON_CLIENT);
    expect(remplacements).toBe(2);
    expect(corps).not.toContain(CLE_ADMIN);
  });

  it("ne touche a rien quand la cle n'est pas la", () => {
    const propre = playbackInfo("un-autre-jeton-parfaitement-legitime");
    const { corps, remplacements } = scrubAdminKey(propre, CLE_ADMIN, JETON_CLIENT);
    expect(remplacements).toBe(0);
    expect(corps).toBe(propre);
  });

  it("efface la cle plutot que de la livrer, meme sans jeton client", () => {
    // Ce cas ne devrait pas se produire — sans jeton entrant, la substitution
    // admin n'a pas lieu non plus. Mais entre un refus franc du proxy et une
    // clé admin livrée, le choix ne se discute pas.
    const { corps, remplacements } = scrubAdminKey(playbackInfo(CLE_ADMIN), CLE_ADMIN, undefined);
    expect(remplacements).toBe(1);
    expect(corps).not.toContain(CLE_ADMIN);
    expect(corps).toContain("api_key=&");
  });
});

describe("manifeste HLS", () => {
  // CONSTATÉ sur le serveur réel : le master.m3u8 rendu par Jellyfin porte la
  // clé admin dans l'URI des tuiles de trickplay. Nettoyer `PlaybackInfo` ne
  // suffisait donc pas — la clé repartait par cette porte-ci.
  const manifeste = [
    "#EXTM3U",
    "#EXT-X-STREAM-INF:BANDWIDTH=4000000",
    "main.m3u8?&DeviceId=dev1&MediaSourceId=ms1",
    `#EXT-X-IMAGE-STREAM-INF:URI="Trickplay/320/tiles.m3u8?MediaSourceId=ms1&ApiKey=${CLE_ADMIN}"`,
  ].join("\n");

  it("retire la cle admin d'un manifeste", () => {
    const { corps, remplacements } = scrubAdminKey(manifeste, CLE_ADMIN, JETON_CLIENT);
    expect(remplacements).toBe(1);
    expect(corps).not.toContain(CLE_ADMIN);
    expect(corps).toContain(`ApiKey=${JETON_CLIENT}`);
  });

  it("laisse le reste du manifeste intact", () => {
    const { corps } = scrubAdminKey(manifeste, CLE_ADMIN, JETON_CLIENT);
    expect(corps.split("\n").length).toBe(manifeste.split("\n").length);
    expect(corps).toContain("#EXT-X-STREAM-INF:BANDWIDTH=4000000");
    expect(corps).toContain("main.m3u8?&DeviceId=dev1&MediaSourceId=ms1");
  });
});

describe("garde-fous du remplacement", () => {
  it("ne fait rien si aucune cle admin n'est configuree", () => {
    const brut = playbackInfo(CLE_ADMIN);
    expect(scrubAdminKey(brut, undefined, JETON_CLIENT)).toEqual({ corps: brut, remplacements: 0 });
    expect(scrubAdminKey(brut, "", JETON_CLIENT)).toEqual({ corps: brut, remplacements: 0 });
  });

  it("refuse de travailler sur une cle absurdement courte", () => {
    // Une configuration bancale ne doit pas mutiler chaque réponse : remplacer
    // « ab » dans un corps JSON le rendrait illisible.
    const brut = JSON.stringify({ Name: "Abracadabra", Id: "ab" });
    expect(scrubAdminKey(brut, "ab", JETON_CLIENT).remplacements).toBe(0);
  });

  it("traite la cle comme une donnee, jamais comme un motif", () => {
    // Une clé porteuse de métacaractères casserait une expression régulière —
    // et un remplacement qui échoue en silence laisse fuir le secret.
    const cle = "a+b.c*d(e)f[g]h$i^j|k?";
    const brut = `{"TranscodingUrl":"/x?api_key=${cle}"}`;
    const { corps, remplacements } = scrubAdminKey(brut, cle, JETON_CLIENT);
    expect(remplacements).toBe(1);
    expect(corps).toContain(`api_key=${JETON_CLIENT}`);
    expect(corps).not.toContain(cle);
  });
});
