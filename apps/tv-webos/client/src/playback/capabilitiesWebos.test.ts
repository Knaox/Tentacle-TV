import { describe, expect, it } from "vitest";
import {
  av1Supported,
  capabilitiesOf,
  dtsSupported,
  bitrateCeiling,
  type HardwareTv,
} from "./capabilitiesWebos";
import type { GenerationWebos } from "./generationWebos";

/**
 * La table décide, à elle seule, de ce qui partira en lecture directe. Une
 * erreur dans un sens coûte un transcodage inutile, dans l'autre une piste
 * muette ou un écran noir — et aucune des deux ne se voit sur un poste de
 * développement, où il n'y a pas de puce LG pour contredire.
 */

function hardware(year: number | null, extra: Partial<HardwareTv> = {}): HardwareTv {
  return { year, oled: false, uhd8K: false, ...extra };
}

/** Codecs audio déclarés pour un conteneur donné. */
function audioOf(generation: GenerationWebos, mat: HardwareTv, name: string): string[] {
  const container = capabilitiesOf(generation, mat).containers.find((c) => c.name.startsWith(name));
  return container?.audio ?? [];
}

/** Codecs vidéo déclarés pour un conteneur donné. */
function videoOf(generation: GenerationWebos, mat: HardwareTv, name: string): string[] {
  const container = capabilitiesOf(generation, mat).containers.find((c) => c.name.startsWith(name));
  return container?.video ?? [];
}

describe("dtsSupporte", () => {
  it("suit la chronologie réelle, qui n'est pas monotone", () => {
    expect(dtsSupported(hardware(2017))).toBe(true);
    // LG restreint alors le DTS à l'USB et à l'HDMI — une app n'est ni l'un ni
    // l'autre.
    expect(dtsSupported(hardware(2019))).toBe(false);
    // Licence retirée.
    expect(dtsSupported(hardware(2020))).toBe(false);
    expect(dtsSupported(hardware(2022))).toBe(false);
    // Retiré à nouveau.
    expect(dtsSupported(hardware(2025))).toBe(false);
  });

  it("réintroduit le DTS en 2023-2024 sur les seules dalles OLED", () => {
    expect(dtsSupported(hardware(2023, { oled: true }))).toBe(true);
    expect(dtsSupported(hardware(2024, { oled: true }))).toBe(true);
    // « available in specific models only » : une gamme d'entrée paiera un
    // transcodage audio plutôt qu'une piste silencieuse.
    expect(dtsSupported(hardware(2023))).toBe(false);
  });

  it("refuse quand l'année est inconnue", () => {
    expect(dtsSupported(hardware(null, { oled: true }))).toBe(false);
  });
});

describe("av1Supporte", () => {
  it("attend les gammes 2023", () => {
    expect(av1Supported(hardware(2020))).toBe(false);
    expect(av1Supported(hardware(2022))).toBe(false);
    expect(av1Supported(hardware(2023))).toBe(true);
  });

  it("débloque les modèles 8K quelle que soit l'année", () => {
    expect(av1Supported(hardware(2020, { uhd8K: true }))).toBe(true);
  });

  it("refuse quand l'année est inconnue", () => {
    expect(av1Supported(hardware(null))).toBe(false);
  });
});

describe("capacitesDe — conteneurs", () => {
  it("n'annonce jamais WebM : LG ne le documente dans aucune génération", () => {
    const names = capabilitiesOf(26, hardware(2026)).containers.map((c) => c.name).join(" ");
    expect(names).not.toContain("webm");
  });

  it("ouvre le MKV, le MP4 et le TS sur toutes les générations", () => {
    for (const generation of [3, 4, 5, 6, 22, 23, 24, 25, 26] as GenerationWebos[]) {
      const names = capabilitiesOf(generation, hardware(null)).containers.map((c) => c.name);
      expect(names).toContain("mkv");
      expect(names).toContain("mp4,m4v,mov");
      expect(names).toContain("ts,m2ts,mts,mpegts");
    }
  });

  it("porte le HEVC en MKV dès webOS 3 — c'est documenté, contrairement au mythe", () => {
    expect(videoOf(3, hardware(2016), "mkv")).toContain("hevc");
  });
});

describe("capacitesDe — AV1", () => {
  it("l'ajoute au MP4 et au MKV quand le matériel le décode", () => {
    const mat = hardware(2023);
    expect(videoOf(24, mat, "mp4")).toContain("av1");
    expect(videoOf(24, mat, "mkv")).toContain("av1");
  });

  it("ne l'ajoute JAMAIS au flux de transport", () => {
    // Le démultiplexeur TS de LG ne connaît pas l'AV1, même sur une dalle qui
    // le décode.
    expect(videoOf(26, hardware(2026), "ts")).not.toContain("av1");
  });
});

describe("capacitesDe — audio", () => {
  it("n'accepte l'E-AC3 en MKV qu'à partir de webOS 4", () => {
    expect(audioOf(3, hardware(2016), "mkv")).not.toContain("eac3");
    expect(audioOf(4, hardware(2018), "mkv")).toContain("eac3");
    // En MP4 et en TS, il y est dès webOS 3.
    expect(audioOf(3, hardware(2016), "mp4")).toContain("eac3");
  });

  it("n'accepte l'Opus en MKV qu'à partir de webOS 24", () => {
    expect(audioOf(23, hardware(2023), "mkv")).not.toContain("opus");
    expect(audioOf(24, hardware(2024), "mkv")).toContain("opus");
  });

  it("déclare le PCM sous les noms que Jellyfin emploie", () => {
    const audio = audioOf(24, hardware(2024), "mkv");
    expect(audio).toContain("pcm_s16le");
    expect(audio).toContain("pcm_s24le");
  });

  it("n'annonce JAMAIS le TrueHD — LG ne le liste nulle part", () => {
    // Le chemin eARC n'est pas accessible depuis une application : la piste
    // serait silencieuse. C'est le cas d'usage du Direct Stream.
    for (const generation of [4, 24, 26] as GenerationWebos[]) {
      const all = capabilitiesOf(generation, hardware(2024, { oled: true }))
        .containers.flatMap((c) => c.audio);
      expect(all).not.toContain("truehd");
      expect(all).not.toContain("mlp");
    }
  });

  it("n'annonce JAMAIS le FLAC dans un conteneur vidéo", () => {
    const capabilities = capabilitiesOf(26, hardware(2026));
    expect(capabilities.containers.flatMap((c) => c.audio)).not.toContain("flac");
    // Il reste lisible comme fichier autonome.
    expect(capabilities.audioContainers).toContain("flac");
  });

  it("place le DTS en MKV avant de le placer en MP4", () => {
    // Le décodeur existe en 2017, mais LG ne liste le DTS en MP4 et en TS qu'à
    // partir de webOS 23.
    const mat = hardware(2017);
    expect(audioOf(3, mat, "mkv")).toContain("dts");
    expect(audioOf(3, mat, "mp4")).not.toContain("dts");
  });

  it("n'annonce jamais le DTS sur une dalle qui ne le décode pas", () => {
    const mat = hardware(2021);
    for (const name of ["mkv", "mp4", "ts"]) {
      expect(audioOf(6, mat, name)).not.toContain("dts");
    }
  });
});

describe("capacitesDe — rendu client", () => {
  it("ne compte sur WebAssembly qu'à partir de webOS 5", () => {
    // Le décodeur PGS du client en dépend : sans lui, un sous-titre image ne
    // s'affiche qu'incrusté par le serveur, donc au prix d'un ré-encodage.
    expect(capabilitiesOf(4, hardware(2018)).wasmAvailable).toBe(false);
    expect(capabilitiesOf(5, hardware(2020)).wasmAvailable).toBe(true);
  });

  it("n'ouvre le Dolby Vision en MKV qu'à partir de webOS 25", () => {
    expect(capabilitiesOf(24, hardware(2024)).doviInMkv).toBe(false);
    expect(capabilitiesOf(25, hardware(2022)).doviInMkv).toBe(true);
  });
});

describe("bitrateCeiling", () => {
  it("reste généreux — un plafond bas ne protège de rien, il fait transcoder", () => {
    expect(bitrateCeiling(false, false)).toBe(80_000_000);
    expect(bitrateCeiling(true, false)).toBe(120_000_000);
    expect(bitrateCeiling(true, true)).toBe(200_000_000);
  });

  it("ne descend jamais sous ce que le client web s'autorise", () => {
    // Le défaut corrigé : la TV était plafonnée plus bas que le navigateur.
    expect(bitrateCeiling(false, false)).toBeGreaterThan(50_000_000);
  });
});
