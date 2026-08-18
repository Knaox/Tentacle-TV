import { describe, expect, it } from "vitest";
import {
  av1Supporte,
  capacitesDe,
  dtsSupporte,
  plafondDebit,
  type MaterielTv,
} from "./capabilitiesWebos";
import type { GenerationWebos } from "./generationWebos";

/**
 * La table décide, à elle seule, de ce qui partira en lecture directe. Une
 * erreur dans un sens coûte un transcodage inutile, dans l'autre une piste
 * muette ou un écran noir — et aucune des deux ne se voit sur un poste de
 * développement, où il n'y a pas de puce LG pour contredire.
 */

function materiel(annee: number | null, extra: Partial<MaterielTv> = {}): MaterielTv {
  return { annee, oled: false, uhd8K: false, ...extra };
}

/** Codecs audio déclarés pour un conteneur donné. */
function audioDe(generation: GenerationWebos, mat: MaterielTv, nom: string): string[] {
  const conteneur = capacitesDe(generation, mat).conteneurs.find((c) => c.nom.startsWith(nom));
  return conteneur?.audio ?? [];
}

/** Codecs vidéo déclarés pour un conteneur donné. */
function videoDe(generation: GenerationWebos, mat: MaterielTv, nom: string): string[] {
  const conteneur = capacitesDe(generation, mat).conteneurs.find((c) => c.nom.startsWith(nom));
  return conteneur?.video ?? [];
}

describe("dtsSupporte", () => {
  it("suit la chronologie réelle, qui n'est pas monotone", () => {
    expect(dtsSupporte(materiel(2017))).toBe(true);
    // LG restreint alors le DTS à l'USB et à l'HDMI — une app n'est ni l'un ni
    // l'autre.
    expect(dtsSupporte(materiel(2019))).toBe(false);
    // Licence retirée.
    expect(dtsSupporte(materiel(2020))).toBe(false);
    expect(dtsSupporte(materiel(2022))).toBe(false);
    // Retiré à nouveau.
    expect(dtsSupporte(materiel(2025))).toBe(false);
  });

  it("réintroduit le DTS en 2023-2024 sur les seules dalles OLED", () => {
    expect(dtsSupporte(materiel(2023, { oled: true }))).toBe(true);
    expect(dtsSupporte(materiel(2024, { oled: true }))).toBe(true);
    // « available in specific models only » : une gamme d'entrée paiera un
    // transcodage audio plutôt qu'une piste silencieuse.
    expect(dtsSupporte(materiel(2023))).toBe(false);
  });

  it("refuse quand l'année est inconnue", () => {
    expect(dtsSupporte(materiel(null, { oled: true }))).toBe(false);
  });
});

describe("av1Supporte", () => {
  it("attend les gammes 2023", () => {
    expect(av1Supporte(materiel(2020))).toBe(false);
    expect(av1Supporte(materiel(2022))).toBe(false);
    expect(av1Supporte(materiel(2023))).toBe(true);
  });

  it("débloque les modèles 8K quelle que soit l'année", () => {
    expect(av1Supporte(materiel(2020, { uhd8K: true }))).toBe(true);
  });

  it("refuse quand l'année est inconnue", () => {
    expect(av1Supporte(materiel(null))).toBe(false);
  });
});

describe("capacitesDe — conteneurs", () => {
  it("n'annonce jamais WebM : LG ne le documente dans aucune génération", () => {
    const noms = capacitesDe(26, materiel(2026)).conteneurs.map((c) => c.nom).join(" ");
    expect(noms).not.toContain("webm");
  });

  it("ouvre le MKV, le MP4 et le TS sur toutes les générations", () => {
    for (const generation of [3, 4, 5, 6, 22, 23, 24, 25, 26] as GenerationWebos[]) {
      const noms = capacitesDe(generation, materiel(null)).conteneurs.map((c) => c.nom);
      expect(noms).toContain("mkv");
      expect(noms).toContain("mp4,m4v,mov");
      expect(noms).toContain("ts,m2ts,mts,mpegts");
    }
  });

  it("porte le HEVC en MKV dès webOS 3 — c'est documenté, contrairement au mythe", () => {
    expect(videoDe(3, materiel(2016), "mkv")).toContain("hevc");
  });
});

describe("capacitesDe — AV1", () => {
  it("l'ajoute au MP4 et au MKV quand le matériel le décode", () => {
    const mat = materiel(2023);
    expect(videoDe(24, mat, "mp4")).toContain("av1");
    expect(videoDe(24, mat, "mkv")).toContain("av1");
  });

  it("ne l'ajoute JAMAIS au flux de transport", () => {
    // Le démultiplexeur TS de LG ne connaît pas l'AV1, même sur une dalle qui
    // le décode.
    expect(videoDe(26, materiel(2026), "ts")).not.toContain("av1");
  });
});

describe("capacitesDe — audio", () => {
  it("n'accepte l'E-AC3 en MKV qu'à partir de webOS 4", () => {
    expect(audioDe(3, materiel(2016), "mkv")).not.toContain("eac3");
    expect(audioDe(4, materiel(2018), "mkv")).toContain("eac3");
    // En MP4 et en TS, il y est dès webOS 3.
    expect(audioDe(3, materiel(2016), "mp4")).toContain("eac3");
  });

  it("n'accepte l'Opus en MKV qu'à partir de webOS 24", () => {
    expect(audioDe(23, materiel(2023), "mkv")).not.toContain("opus");
    expect(audioDe(24, materiel(2024), "mkv")).toContain("opus");
  });

  it("déclare le PCM sous les noms que Jellyfin emploie", () => {
    const audio = audioDe(24, materiel(2024), "mkv");
    expect(audio).toContain("pcm_s16le");
    expect(audio).toContain("pcm_s24le");
  });

  it("n'annonce JAMAIS le TrueHD — LG ne le liste nulle part", () => {
    // Le chemin eARC n'est pas accessible depuis une application : la piste
    // serait silencieuse. C'est le cas d'usage du Direct Stream.
    for (const generation of [4, 24, 26] as GenerationWebos[]) {
      const tout = capacitesDe(generation, materiel(2024, { oled: true }))
        .conteneurs.flatMap((c) => c.audio);
      expect(tout).not.toContain("truehd");
      expect(tout).not.toContain("mlp");
    }
  });

  it("n'annonce JAMAIS le FLAC dans un conteneur vidéo", () => {
    const capacites = capacitesDe(26, materiel(2026));
    expect(capacites.conteneurs.flatMap((c) => c.audio)).not.toContain("flac");
    // Il reste lisible comme fichier autonome.
    expect(capacites.conteneursAudio).toContain("flac");
  });

  it("place le DTS en MKV avant de le placer en MP4", () => {
    // Le décodeur existe en 2017, mais LG ne liste le DTS en MP4 et en TS qu'à
    // partir de webOS 23.
    const mat = materiel(2017);
    expect(audioDe(3, mat, "mkv")).toContain("dts");
    expect(audioDe(3, mat, "mp4")).not.toContain("dts");
  });

  it("n'annonce jamais le DTS sur une dalle qui ne le décode pas", () => {
    const mat = materiel(2021);
    for (const nom of ["mkv", "mp4", "ts"]) {
      expect(audioDe(6, mat, nom)).not.toContain("dts");
    }
  });
});

describe("capacitesDe — rendu client", () => {
  it("ne compte sur WebAssembly qu'à partir de webOS 5", () => {
    // Le décodeur PGS du client en dépend : sans lui, un sous-titre image ne
    // s'affiche qu'incrusté par le serveur, donc au prix d'un ré-encodage.
    expect(capacitesDe(4, materiel(2018)).wasmDisponible).toBe(false);
    expect(capacitesDe(5, materiel(2020)).wasmDisponible).toBe(true);
  });

  it("n'ouvre le Dolby Vision en MKV qu'à partir de webOS 25", () => {
    expect(capacitesDe(24, materiel(2024)).doviEnMkv).toBe(false);
    expect(capacitesDe(25, materiel(2022)).doviEnMkv).toBe(true);
  });
});

describe("plafondDebit", () => {
  it("reste généreux — un plafond bas ne protège de rien, il fait transcoder", () => {
    expect(plafondDebit(false, false)).toBe(80_000_000);
    expect(plafondDebit(true, false)).toBe(120_000_000);
    expect(plafondDebit(true, true)).toBe(200_000_000);
  });

  it("ne descend jamais sous ce que le client web s'autorise", () => {
    // Le défaut corrigé : la TV était plafonnée plus bas que le navigateur.
    expect(plafondDebit(false, false)).toBeGreaterThan(50_000_000);
  });
});
