import { describe, expect, it } from "vitest";
import { transcode } from "./remuxWebos";
import { capabilitiesOf } from "./capabilitiesWebos";
import type { ResolvedProfile } from "./codecsWebos";

/**
 * L'ordre des profils de transcodage EST la décision : Jellyfin retient le
 * premier qui convient, sans jamais regarder le fichier. C'est donc au client
 * de placer devant celui qui préserve le plus.
 */

/** Une C3 de 2023 : la dalle qui a servi à toutes les mesures citées ici. */
function resolved(dolbyVision: boolean, dolbyAtmos = true): ResolvedProfile {
  const hardware = { year: 2023, oled: true, uhd8K: false };
  return {
    platform: { generation: 25, year: 2023, source: "ua" },
    capabilities: capabilitiesOf(25, hardware),
    panel: { uhd: true, uhd8K: false, hdr10: true, dolbyVision, dolbyAtmos, oled: true },
  };
}

const empty = { containers: [], video: [], audio: [] };

describe("transcodage", () => {
  it("place le flux de transport devant pour une source Dolby Vision", () => {
    // Mesuré sur une C3 en webOS 25 : le même remux rend « HDR10 » en fMP4 et
    // « DolbyVision » en TS. L'image est copiée dans les deux cas.
    const profiles = transcode(resolved(true), empty, true);
    expect(profiles[0].Container).toBe("ts");
    expect(profiles[1].Container).toBe("mp4");
  });

  it("garde le fMP4 devant hors Dolby Vision — c'est lui qui copie le DTS", () => {
    const profiles = transcode(resolved(true), empty, false);
    expect(profiles[0].Container).toBe("mp4");
    expect(profiles[0].AudioCodec).toContain("dts");
  });

  it("garde le fMP4 devant sur une dalle sans Dolby Vision", () => {
    // La question n'a alors pas d'objet, et le DTS copié reprend l'avantage.
    const profiles = transcode(resolved(false), empty, true);
    expect(profiles[0].Container).toBe("mp4");
  });

  it("convertit vers l'E-AC3 avant l'AAC, en huit canaux", () => {
    // Le rang décide de la CONVERSION, pas de la copie. L'E-AC3 devant, c'est
    // du bitstream Dolby vers l'eARC ; l'AAC devant, c'est du PCM décodé par la
    // dalle, donc plus d'Atmos.
    const ts = transcode(resolved(true), empty, true)[0];
    expect(ts.AudioCodec?.split(",")[0]).toBe("eac3");
    expect(ts.AudioCodec).toContain("aac");
    expect(ts.MaxAudioChannels).toBe("8");
  });

  it("garde l'AAC en dernier recours quand la dalle ignore les Dolby", () => {
    // Une liste vide ferait recompresser l'image faute de profil : l'AAC est le
    // seul codec qu'aucune génération n'ait jamais refusé.
    const withoutDolby = { containers: [], video: [], audio: ["ac3", "eac3"] };
    const ts = transcode(resolved(true), withoutDolby, true)[0];
    expect(ts.AudioCodec).toBe("aac");
  });

  it("n'annonce jamais l'AV1 ni le VP9 en flux de transport", () => {
    const ts = transcode(resolved(true), empty, true)[0];
    expect(ts.VideoCodec).not.toContain("av1");
    expect(ts.VideoCodec).not.toContain("vp9");
    expect(ts.VideoCodec).toContain("hevc");
  });

  it("garde le transcodage audio seul en dernier, quel que soit l'ordre", () => {
    for (const dv of [true, false]) {
      const profiles = transcode(resolved(true), empty, dv);
      expect(profiles[profiles.length - 1].Type).toBe("Audio");
    }
  });
});
