import { describe, expect, it } from "vitest";
import { estManifesteMaitre, ligneVarianteDovi, urlAbsolueVariante } from "./doviVariant";

/**
 * Ce que ces cas protègent ne se voit pas à l'écran : une variante mal choisie
 * donne une image qui s'affiche, en SDR, pendant que le serveur ré-encode du 4K
 * en silence. Le seul symptôme est la chaleur du serveur.
 */

const MANIFESTE_DOVI = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=20750353,VIDEO-RANGE=PQ,CODECS="hvc1.2.4.L150.B0,ec-3",SUPPLEMENTAL-CODECS="dvh1.08.06/db1p",RESOLUTION=3840x2160
main.m3u8?VideoCodec=hevc&PlaySessionId=abc
#EXT-X-STREAM-INF:BANDWIDTH=20750353,VIDEO-RANGE=SDR,CODECS="hvc1.2.4.L150.B0,ec-3",RESOLUTION=3840x2160
main.m3u8?VideoCodec=hevc&AllowVideoStreamCopy=false
#EXT-X-STREAM-INF:BANDWIDTH=20750353,VIDEO-RANGE=SDR,CODECS="avc1.424033,ec-3",RESOLUTION=3840x2160
main.m3u8?VideoCodec=h264&AllowVideoStreamCopy=false
`;

const MANIFESTE_ORDINAIRE = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=8000000,VIDEO-RANGE=PQ,CODECS="hvc1.2.4.L150.B0",RESOLUTION=3840x2160
main.m3u8?VideoCodec=hevc
`;

describe("choix de la variante Dolby Vision", () => {
  it("désigne la variante marquée, et non la première venue", () => {
    expect(ligneVarianteDovi(MANIFESTE_DOVI)).toBe("main.m3u8?VideoCodec=hevc&PlaySessionId=abc");
  });

  it("ne se laisse pas prendre par un HDR10 ordinaire", () => {
    // `VIDEO-RANGE=PQ` désigne aussi bien du HDR10 : seul `SUPPLEMENTAL-CODECS`
    // dit qu'il y a un Dolby Vision à aller chercher.
    expect(ligneVarianteDovi(MANIFESTE_ORDINAIRE)).toBeNull();
  });

  it("rend la main quand la variante n'a pas d'URL", () => {
    // Manifeste tronqué : fabriquer une adresse serait pire que de laisser le
    // téléviseur choisir.
    const tronque = MANIFESTE_DOVI.split("\n").slice(0, 2).join("\n");
    expect(ligneVarianteDovi(tronque)).toBeNull();
  });

  it("ignore une ligne de tag là où une URL est attendue", () => {
    const casse = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1,SUPPLEMENTAL-CODECS="dvh1.08.06/db1p"
#EXT-X-ENDLIST
`;
    expect(ligneVarianteDovi(casse)).toBeNull();
  });

  it("trouve la variante même si elle n'est pas en tête", () => {
    // Jellyfin la place en premier aujourd'hui ; aucune spécification ne l'y
    // oblige, et ce choix ne doit pas dépendre d'un ordre.
    const inverse = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1,VIDEO-RANGE=SDR,CODECS="avc1.424033"
main.m3u8?VideoCodec=h264
#EXT-X-STREAM-INF:BANDWIDTH=1,VIDEO-RANGE=PQ,SUPPLEMENTAL-CODECS="dvh1.08.06/db1p"
main.m3u8?VideoCodec=hevc
`;
    expect(ligneVarianteDovi(inverse)).toBe("main.m3u8?VideoCodec=hevc");
  });
});

describe("résolution en URL absolue", () => {
  const PAGE = "http://172.16.1.179:3001/tv/watch/abc";

  it("résout un manifeste servi par un chemin RELATIF", () => {
    // Le cas réel, et celui qui avait échoué en silence : le client parle au
    // proxy par `/api/jellyfin/…`. Une balise `<video>` résout ce chemin toute
    // seule, `new URL` non — il faut d'abord rendre la base absolue.
    const master = "/api/jellyfin/videos/xyz/master.m3u8?DeviceId=1&api_key=jwt";
    expect(urlAbsolueVariante("main.m3u8?VideoCodec=hevc", master, PAGE))
      .toBe("http://172.16.1.179:3001/api/jellyfin/videos/xyz/main.m3u8?VideoCodec=hevc");
  });

  it("résout aussi un manifeste déjà absolu", () => {
    const master = "http://serveur:8096/videos/xyz/master.m3u8?a=1";
    expect(urlAbsolueVariante("main.m3u8?b=2", master, PAGE))
      .toBe("http://serveur:8096/videos/xyz/main.m3u8?b=2");
  });

  it("n'hérite pas de la chaîne de requête du manifeste", () => {
    const master = "/api/jellyfin/videos/xyz/master.m3u8?Tag=abc&api_key=jwt";
    const u = urlAbsolueVariante("main.m3u8?Tag=def", master, PAGE);
    expect(u).toContain("Tag=def");
    expect(u).not.toContain("api_key=jwt");
  });

  it("rend la main plutôt qu'une adresse fausse", () => {
    expect(urlAbsolueVariante("main.m3u8", "master.m3u8", "pas une URL")).toBeNull();
  });
});

describe("reconnaissance du manifeste maître", () => {
  it("ne s'applique qu'au manifeste maître", () => {
    expect(estManifesteMaitre("http://h/videos/1/master.m3u8?x=1")).toBe(true);
    // Une lecture directe n'a aucune variante à choisir.
    expect(estManifesteMaitre("http://h/Videos/1/stream?Static=true")).toBe(false);
    // Une playlist de variante non plus — sans quoi on la re-résoudrait sans fin.
    expect(estManifesteMaitre("http://h/videos/1/main.m3u8?x=1")).toBe(false);
  });
});
