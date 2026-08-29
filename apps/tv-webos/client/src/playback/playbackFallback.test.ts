import { describe, expect, it } from "vitest";
import {
  keptCodecs,
  keptContainer,
  stepDown,
  EMPTY_MEMORY,
  type FallbackMemory,
} from "./playbackFallback";

/**
 * L'ordre des étages est tout l'enjeu : un seul recompresse l'image, et il doit
 * être le dernier atteint. Moonfin saute directement au transcodage complet à la
 * première erreur venue — c'est ce comportement-là que ces tests interdisent.
 */

const MKV_HEVC_TRUEHD = { container: "mkv", videoCodec: "hevc", audioCodec: "truehd" };

/** Enchaîne les échecs d'une même source et rend les étages atteints. */
function fall(source: typeof MKV_HEVC_TRUEHD, times: number): string[] {
  let memory: FallbackMemory = EMPTY_MEMORY;
  const stages: string[] = [];
  for (let i = 0; i < times; i++) {
    const fallback = stepDown(memory, source);
    memory = fallback.memory;
    stages.push(fallback.stage);
  }
  return stages;
}

describe("descendre", () => {
  it("descend d'un étage à la fois, du moins cher au plus cher", () => {
    expect(fall(MKV_HEVC_TRUEHD, 4)).toEqual(["conteneur", "audio", "video", "epuise"]);
  });

  it("ne recompresse l'image qu'au troisième étage", () => {
    // Les deux premiers replis sont un remux, puis un remux avec conversion
    // audio : l'image y est copiée dans les deux cas.
    let memory: FallbackMemory = EMPTY_MEMORY;
    const first = stepDown(memory, MKV_HEVC_TRUEHD);
    expect(first.videoReencoded).toBe(false);
    memory = first.memory;

    const second = stepDown(memory, MKV_HEVC_TRUEHD);
    expect(second.videoReencoded).toBe(false);
    memory = second.memory;

    expect(stepDown(memory, MKV_HEVC_TRUEHD).videoReencoded).toBe(true);
  });

  it("commence par l'audio quand le conteneur a déjà été retiré", () => {
    const memory: FallbackMemory = { containers: ["mkv"], audio: [], video: [] };
    expect(stepDown(memory, MKV_HEVC_TRUEHD).stage).toBe("audio");
  });

  it("saute ce que la source ne renseigne pas", () => {
    // Jellyfin ne décrit pas toujours toutes les pistes : un champ absent ne
    // doit pas bloquer la descente.
    const fallback = stepDown(EMPTY_MEMORY, { videoCodec: "hevc" });
    expect(fallback.stage).toBe("video");
    expect(fallback.removed).toBe("hevc");
  });

  it("s'épuise proprement sur une source vide", () => {
    const fallback = stepDown(EMPTY_MEMORY, {});
    expect(fallback.stage).toBe("epuise");
    expect(fallback.memory).toEqual(EMPTY_MEMORY);
  });

  it("normalise la casse et les espaces des noms Jellyfin", () => {
    const fallback = stepDown(EMPTY_MEMORY, { container: " MKV " });
    expect(fallback.memory.containers).toEqual(["mkv"]);
  });

  it("ne modifie pas la mémoire qu'on lui passe", () => {
    const memory = EMPTY_MEMORY;
    stepDown(memory, MKV_HEVC_TRUEHD);
    expect(memory.containers).toEqual([]);
  });
});

describe("conteneurRetenu", () => {
  it("écarte tout un groupe dès qu'une de ses extensions a échoué", () => {
    // « ts,m2ts,mts » passe par le même démultiplexeur : si le m2ts a échoué,
    // insister sur le ts n'a pas de sens.
    const memory: FallbackMemory = { containers: ["m2ts"], audio: [], video: [] };
    expect(keptContainer(memory, "ts,m2ts,mts,mpegts")).toBe(false);
    expect(keptContainer(memory, "mp4,m4v,mov")).toBe(true);
  });

  it("garde tout quand rien n'a échoué", () => {
    expect(keptContainer(EMPTY_MEMORY, "mkv")).toBe(true);
  });
});

describe("codecsRetenus", () => {
  it("retire les codecs disqualifiés sans toucher aux autres", () => {
    expect(keptCodecs(["truehd"], ["aac", "eac3", "truehd"])).toEqual(["aac", "eac3"]);
  });

  it("rend la liste telle quelle quand rien n'est disqualifié", () => {
    const codecs = ["aac", "eac3"];
    expect(keptCodecs([], codecs)).toBe(codecs);
  });
});
