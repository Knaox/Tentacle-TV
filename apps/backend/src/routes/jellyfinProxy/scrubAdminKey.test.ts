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
import { carriesPlaybackUrl, scrubAdminKey } from "./scrubAdminKey";

/** 32 hexadécimaux, la forme d'une clé d'API Jellyfin. */
const ADMIN_KEY = "05ddc30d1f4b4a8fa2c9e7b6d3841fae";
const CLIENT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.client";

function playbackInfo(key: string): string {
  return JSON.stringify({
    MediaSources: [
      {
        Id: "ms1",
        SupportsDirectPlay: false,
        SupportsTranscoding: true,
        TranscodingUrl:
          `/videos/42/main.m3u8?DeviceId=dev1&MediaSourceId=ms1&api_key=${key}` +
          "&VideoCodec=h264&AudioCodec=aac&TranscodingMaxAudioChannels=2",
      },
    ],
    PlaySessionId: "ps-9",
  });
}

describe("routes dont la reponse est relue", () => {
  it("reconnait les deux formes de PlaybackInfo", () => {
    // Les deux sont autorisées par `patterns.ts`.
    expect(carriesPlaybackUrl("Videos/42/PlaybackInfo")).toBe(true);
    expect(carriesPlaybackUrl("Items/42/PlaybackInfo")).toBe(true);
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
      expect(carriesPlaybackUrl(path), path).toBe(false);
    }
  });

  it("ne se laisse pas berner par un chemin qui contient le mot", () => {
    expect(carriesPlaybackUrl("Items/PlaybackInfoBis")).toBe(false);
    expect(carriesPlaybackUrl("PlaybackInfoOther/42")).toBe(false);
  });
});

describe("nettoyage de la cle admin", () => {
  it("remplace la cle par le jeton du client dans le TranscodingUrl", () => {
    const { body, replacements } = scrubAdminKey(playbackInfo(ADMIN_KEY), ADMIN_KEY, CLIENT_TOKEN);
    expect(replacements).toBe(1);
    expect(body).not.toContain(ADMIN_KEY);
    expect(body).toContain(`api_key=${CLIENT_TOKEN}`);
    // Le reste de l'URL doit survivre : c'est elle qui pilote le transcodage.
    expect(body).toContain("VideoCodec=h264");
    expect(body).toContain("MediaSourceId=ms1");
    // Et le JSON doit rester du JSON.
    expect(() => JSON.parse(body) as unknown).not.toThrow();
  });

  it("remplace TOUTES les occurrences", () => {
    // Jellyfin recopie parfois l'URL dans plusieurs sources média.
    const two = JSON.stringify({
      MediaSources: [
        { TranscodingUrl: `/a?api_key=${ADMIN_KEY}` },
        { TranscodingUrl: `/b?api_key=${ADMIN_KEY}` },
      ],
    });
    const { body, replacements } = scrubAdminKey(two, ADMIN_KEY, CLIENT_TOKEN);
    expect(replacements).toBe(2);
    expect(body).not.toContain(ADMIN_KEY);
  });

  it("ne touche a rien quand la cle n'est pas la", () => {
    const clean = playbackInfo("un-autre-jeton-parfaitement-legitime");
    const { body, replacements } = scrubAdminKey(clean, ADMIN_KEY, CLIENT_TOKEN);
    expect(replacements).toBe(0);
    expect(body).toBe(clean);
  });

  it("efface la cle plutot que de la livrer, meme sans jeton client", () => {
    // Ce cas ne devrait pas se produire — sans jeton entrant, la substitution
    // admin n'a pas lieu non plus. Mais entre un refus franc du proxy et une
    // clé admin livrée, le choix ne se discute pas.
    const { body, replacements } = scrubAdminKey(playbackInfo(ADMIN_KEY), ADMIN_KEY, undefined);
    expect(replacements).toBe(1);
    expect(body).not.toContain(ADMIN_KEY);
    expect(body).toContain("api_key=&");
  });
});

describe("manifeste HLS", () => {
  // CONSTATÉ sur le serveur réel : le master.m3u8 rendu par Jellyfin porte la
  // clé admin dans l'URI des tuiles de trickplay. Nettoyer `PlaybackInfo` ne
  // suffisait donc pas — la clé repartait par cette porte-ci.
  const manifest = [
    "#EXTM3U",
    "#EXT-X-STREAM-INF:BANDWIDTH=4000000",
    "main.m3u8?&DeviceId=dev1&MediaSourceId=ms1",
    `#EXT-X-IMAGE-STREAM-INF:URI="Trickplay/320/tiles.m3u8?MediaSourceId=ms1&ApiKey=${ADMIN_KEY}"`,
  ].join("\n");

  it("retire la cle admin d'un manifeste", () => {
    const { body, replacements } = scrubAdminKey(manifest, ADMIN_KEY, CLIENT_TOKEN);
    expect(replacements).toBe(1);
    expect(body).not.toContain(ADMIN_KEY);
    expect(body).toContain(`ApiKey=${CLIENT_TOKEN}`);
  });

  it("laisse le reste du manifeste intact", () => {
    const { body } = scrubAdminKey(manifest, ADMIN_KEY, CLIENT_TOKEN);
    expect(body.split("\n").length).toBe(manifest.split("\n").length);
    expect(body).toContain("#EXT-X-STREAM-INF:BANDWIDTH=4000000");
    expect(body).toContain("main.m3u8?&DeviceId=dev1&MediaSourceId=ms1");
  });
});

describe("garde-fous du remplacement", () => {
  it("ne fait rien si aucune cle admin n'est configuree", () => {
    const raw = playbackInfo(ADMIN_KEY);
    expect(scrubAdminKey(raw, undefined, CLIENT_TOKEN)).toEqual({ body: raw, replacements: 0 });
    expect(scrubAdminKey(raw, "", CLIENT_TOKEN)).toEqual({ body: raw, replacements: 0 });
  });

  it("refuse de travailler sur une cle absurdement courte", () => {
    // Une configuration bancale ne doit pas mutiler chaque réponse : remplacer
    // « ab » dans un corps JSON le rendrait illisible.
    const raw = JSON.stringify({ Name: "Abracadabra", Id: "ab" });
    expect(scrubAdminKey(raw, "ab", CLIENT_TOKEN).replacements).toBe(0);
  });

  it("traite la cle comme une donnee, jamais comme un motif", () => {
    // Une clé porteuse de métacaractères casserait une expression régulière —
    // et un remplacement qui échoue en silence laisse fuir le secret.
    const key = "a+b.c*d(e)f[g]h$i^j|k?";
    const raw = `{"TranscodingUrl":"/x?api_key=${key}"}`;
    const { body, replacements } = scrubAdminKey(raw, key, CLIENT_TOKEN);
    expect(replacements).toBe(1);
    expect(body).toContain(`api_key=${CLIENT_TOKEN}`);
    expect(body).not.toContain(key);
  });
});
