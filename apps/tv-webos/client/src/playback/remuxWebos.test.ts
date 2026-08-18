import { describe, expect, it } from "vitest";
import { transcodage } from "./remuxWebos";
import { capacitesDe } from "./capabilitiesWebos";
import type { ProfilResolu } from "./codecsWebos";

/**
 * L'ordre des profils de transcodage EST la décision : Jellyfin retient le
 * premier qui convient, sans jamais regarder le fichier. C'est donc au client
 * de placer devant celui qui préserve le plus.
 */

/** Une C3 de 2023 : la dalle qui a servi à toutes les mesures citées ici. */
function resolu(dolbyVision: boolean, dolbyAtmos = true): ProfilResolu {
  const materiel = { annee: 2023, oled: true, uhd8K: false };
  return {
    plateforme: { generation: 25, annee: 2023, source: "ua" },
    capacites: capacitesDe(25, materiel),
    dalle: { uhd: true, uhd8K: false, hdr10: true, dolbyVision, dolbyAtmos, oled: true },
  };
}

const vide = { conteneurs: [], video: [], audio: [] };

describe("transcodage", () => {
  it("place le flux de transport devant pour une source Dolby Vision", () => {
    // Mesuré sur une C3 en webOS 25 : le même remux rend « HDR10 » en fMP4 et
    // « DolbyVision » en TS. L'image est copiée dans les deux cas.
    const profils = transcodage(resolu(true), vide, true);
    expect(profils[0].Container).toBe("ts");
    expect(profils[1].Container).toBe("mp4");
  });

  it("garde le fMP4 devant hors Dolby Vision — c'est lui qui copie le DTS", () => {
    const profils = transcodage(resolu(true), vide, false);
    expect(profils[0].Container).toBe("mp4");
    expect(profils[0].AudioCodec).toContain("dts");
  });

  it("garde le fMP4 devant sur une dalle sans Dolby Vision", () => {
    // La question n'a alors pas d'objet, et le DTS copié reprend l'avantage.
    const profils = transcodage(resolu(false), vide, true);
    expect(profils[0].Container).toBe("mp4");
  });

  it("convertit vers l'E-AC3 avant l'AAC, en huit canaux", () => {
    // Le rang décide de la CONVERSION, pas de la copie. L'E-AC3 devant, c'est
    // du bitstream Dolby vers l'eARC ; l'AAC devant, c'est du PCM décodé par la
    // dalle, donc plus d'Atmos.
    const ts = transcodage(resolu(true), vide, true)[0];
    expect(ts.AudioCodec?.split(",")[0]).toBe("eac3");
    expect(ts.AudioCodec).toContain("aac");
    expect(ts.MaxAudioChannels).toBe("8");
  });

  it("garde l'AAC en dernier recours quand la dalle ignore les Dolby", () => {
    // Une liste vide ferait recompresser l'image faute de profil : l'AAC est le
    // seul codec qu'aucune génération n'ait jamais refusé.
    const sansDolby = { conteneurs: [], video: [], audio: ["ac3", "eac3"] };
    const ts = transcodage(resolu(true), sansDolby, true)[0];
    expect(ts.AudioCodec).toBe("aac");
  });

  it("n'annonce jamais l'AV1 ni le VP9 en flux de transport", () => {
    const ts = transcodage(resolu(true), vide, true)[0];
    expect(ts.VideoCodec).not.toContain("av1");
    expect(ts.VideoCodec).not.toContain("vp9");
    expect(ts.VideoCodec).toContain("hevc");
  });

  it("garde le transcodage audio seul en dernier, quel que soit l'ordre", () => {
    for (const dv of [true, false]) {
      const profils = transcodage(resolu(true), vide, dv);
      expect(profils[profils.length - 1].Type).toBe("Audio");
    }
  });
});
