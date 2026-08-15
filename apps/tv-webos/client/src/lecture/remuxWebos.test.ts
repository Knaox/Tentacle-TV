import { describe, expect, it } from "vitest";
import { transcodage } from "./remuxWebos";
import { capacitesDe } from "./capacitesWebos";
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

  it("laisse le flux de transport porter l'E-AC3 en huit canaux", () => {
    // C'est ce qui permet à un TrueHD 7.1 Atmos converti de rester en Atmos :
    // l'E-AC3 JOC est exactement le format des applications de LG.
    const ts = transcodage(resolu(true), vide, true)[0];
    expect(ts.AudioCodec).toContain("eac3");
    expect(ts.MaxAudioChannels).toBe("8");
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
