/**
 * Le panneau répond à des questions dont la mauvaise réponse coûte cher : un
 * film téléchargé qui se lirait quand même depuis le serveur donnerait une
 * image PARFAITE, et le défaut passerait inaperçu. Ces verdicts sont de la
 * logique pure sur un relevé de propriétés — ils se vérifient donc sans mpv.
 */

import { describe, expect, it } from "vitest";
import { verdicts } from "./playerDebugVerdict";

type Lues = Record<string, string | null>;

function ligne(p: Lues, cle: string): string {
  const trouve = verdicts(p, false).find((v) => v.cle === cle);
  return trouve?.valeur ?? "";
}

const LOCAL = "C:\\Users\\x\\AppData\\Roaming\\com.tentacle.media\\downloads\\media\\i1\\original-ms1.mkv";
const DISTANT = "https://tv.exemple/api/downloads/original/i1?mediaSourceId=ms1";

describe("flux : disque ou reseau", () => {
  it("un fichier local est annonce LOCAL, avec son nom", () => {
    const v = ligne({ path: LOCAL, "demuxer-via-network": "no", "cache-speed": "24000000" }, "Flux");
    expect(v).toContain("LOCAL");
    expect(v).toContain("original-ms1.mkv");
    expect(v).toContain("24.0 Mo/s");
  });

  it("une URL est annoncee RESEAU, avec son hote", () => {
    const v = ligne({ path: DISTANT, "demuxer-via-network": "yes", "cache-speed": "5100000" }, "Flux");
    expect(v).toContain("RESEAU");
    expect(v).toContain("tv.exemple");
    expect(v).toContain("5.1 Mo/s");
  });

  it("mpv fait autorite sur le chemin : une URL locale servie par le reseau reste RESEAU", () => {
    // Le cas qui piege un test de schema : le chemin ressemble a un fichier,
    // mais mpv sait qu'il a ouvert un flux.
    expect(ligne({ path: LOCAL, "demuxer-via-network": "yes" }, "Flux")).toContain("RESEAU");
  });

  it("sans la propriete, on retombe sur le schema du chemin", () => {
    expect(ligne({ path: DISTANT }, "Flux")).toContain("RESEAU");
    expect(ligne({ path: LOCAL }, "Flux")).toContain("LOCAL");
    expect(ligne({ path: LOCAL, "demuxer-via-network": null }, "Flux")).toContain("LOCAL");
  });

  it("un debit deja mis en forme par mpv est relaye tel quel", () => {
    // `mpv_get_property_string` rend la forme d'AFFICHAGE quand la propriete en
    // definit une : « 5.3 MiB/s » et non un entier.
    expect(ligne({ path: LOCAL, "cache-speed": "5.3 MiB/s" }, "Flux")).toContain("5.3 MiB/s");
  });

  it("un debit absent, nul ou minuscule reste lisible", () => {
    expect(ligne({ path: LOCAL }, "Flux")).toContain("debit inconnu");
    expect(ligne({ path: LOCAL, "cache-speed": "0" }, "Flux")).toContain("0 o/s");
    expect(ligne({ path: LOCAL, "cache-speed": "48000" }, "Flux")).toContain("48 ko/s");
  });
});

describe("source : direct ou transcode", () => {
  it("un .m3u8 trahit le transcodage", () => {
    expect(ligne({ path: "https://tv.exemple/x/master.m3u8" }, "Source")).toContain("TRANSCODE");
  });

  it("un fichier local est de la lecture directe", () => {
    expect(ligne({ path: LOCAL }, "Source")).toBe("lecture directe");
  });
});

describe("hdr : la sortie fait foi, jamais le reglage", () => {
  const base: Lues = { "video-params/gamma": "pq", "video-params/primaries": "bt.2020" };

  it("contenu pq mais sortie srgb : tone-mappe", () => {
    const v = verdicts({ ...base, "video-target-params/gamma": "srgb" }, true);
    const hdr = v.find((x) => x.cle === "HDR");
    expect(hdr?.valeur).toContain("TONE-MAPPE");
    expect(hdr?.bon).toBe(false);
  });

  it("contenu pq, sortie pq, ecran en HDR : reel", () => {
    const v = verdicts(
      { ...base, "video-target-params/gamma": "pq", "video-target-params/primaries": "bt.2020" },
      true,
    );
    const hdr = v.find((x) => x.cle === "HDR");
    expect(hdr?.valeur).toContain("REEL");
    expect(hdr?.bon).toBe(true);
  });

  it("sortie pq mais ecran SDR : image sombre, et on le dit", () => {
    const v = verdicts({ ...base, "video-target-params/gamma": "pq" }, false);
    expect(v.find((x) => x.cle === "HDR")?.bon).toBe(false);
  });

  it("un contenu SDR n'a rien a transmettre, et ce n'est pas un defaut", () => {
    const v = verdicts({ "video-params/gamma": "bt.1886" }, false);
    const hdr = v.find((x) => x.cle === "HDR");
    expect(hdr?.valeur).toContain("contenu SDR");
    expect(hdr?.bon).toBeNull();
  });
});
