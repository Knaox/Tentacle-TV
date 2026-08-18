import { describe, expect, it } from "vitest";
import {
  codecsRetenus,
  conteneurRetenu,
  descendre,
  MEMOIRE_VIDE,
  type MemoireReplis,
} from "./playbackFallback";

/**
 * L'ordre des étages est tout l'enjeu : un seul recompresse l'image, et il doit
 * être le dernier atteint. Moonfin saute directement au transcodage complet à la
 * première erreur venue — c'est ce comportement-là que ces tests interdisent.
 */

const MKV_HEVC_TRUEHD = { conteneur: "mkv", codecVideo: "hevc", codecAudio: "truehd" };

/** Enchaîne les échecs d'une même source et rend les étages atteints. */
function chute(source: typeof MKV_HEVC_TRUEHD, fois: number): string[] {
  let memoire: MemoireReplis = MEMOIRE_VIDE;
  const etages: string[] = [];
  for (let i = 0; i < fois; i++) {
    const repli = descendre(memoire, source);
    memoire = repli.memoire;
    etages.push(repli.etage);
  }
  return etages;
}

describe("descendre", () => {
  it("descend d'un étage à la fois, du moins cher au plus cher", () => {
    expect(chute(MKV_HEVC_TRUEHD, 4)).toEqual(["conteneur", "audio", "video", "epuise"]);
  });

  it("ne recompresse l'image qu'au troisième étage", () => {
    // Les deux premiers replis sont un remux, puis un remux avec conversion
    // audio : l'image y est copiée dans les deux cas.
    let memoire: MemoireReplis = MEMOIRE_VIDE;
    const premier = descendre(memoire, MKV_HEVC_TRUEHD);
    expect(premier.reencodageVideo).toBe(false);
    memoire = premier.memoire;

    const deuxieme = descendre(memoire, MKV_HEVC_TRUEHD);
    expect(deuxieme.reencodageVideo).toBe(false);
    memoire = deuxieme.memoire;

    expect(descendre(memoire, MKV_HEVC_TRUEHD).reencodageVideo).toBe(true);
  });

  it("commence par l'audio quand le conteneur a déjà été retiré", () => {
    const memoire: MemoireReplis = { conteneurs: ["mkv"], audio: [], video: [] };
    expect(descendre(memoire, MKV_HEVC_TRUEHD).etage).toBe("audio");
  });

  it("saute ce que la source ne renseigne pas", () => {
    // Jellyfin ne décrit pas toujours toutes les pistes : un champ absent ne
    // doit pas bloquer la descente.
    const repli = descendre(MEMOIRE_VIDE, { codecVideo: "hevc" });
    expect(repli.etage).toBe("video");
    expect(repli.retire).toBe("hevc");
  });

  it("s'épuise proprement sur une source vide", () => {
    const repli = descendre(MEMOIRE_VIDE, {});
    expect(repli.etage).toBe("epuise");
    expect(repli.memoire).toEqual(MEMOIRE_VIDE);
  });

  it("normalise la casse et les espaces des noms Jellyfin", () => {
    const repli = descendre(MEMOIRE_VIDE, { conteneur: " MKV " });
    expect(repli.memoire.conteneurs).toEqual(["mkv"]);
  });

  it("ne modifie pas la mémoire qu'on lui passe", () => {
    const memoire = MEMOIRE_VIDE;
    descendre(memoire, MKV_HEVC_TRUEHD);
    expect(memoire.conteneurs).toEqual([]);
  });
});

describe("conteneurRetenu", () => {
  it("écarte tout un groupe dès qu'une de ses extensions a échoué", () => {
    // « ts,m2ts,mts » passe par le même démultiplexeur : si le m2ts a échoué,
    // insister sur le ts n'a pas de sens.
    const memoire: MemoireReplis = { conteneurs: ["m2ts"], audio: [], video: [] };
    expect(conteneurRetenu(memoire, "ts,m2ts,mts,mpegts")).toBe(false);
    expect(conteneurRetenu(memoire, "mp4,m4v,mov")).toBe(true);
  });

  it("garde tout quand rien n'a échoué", () => {
    expect(conteneurRetenu(MEMOIRE_VIDE, "mkv")).toBe(true);
  });
});

describe("codecsRetenus", () => {
  it("retire les codecs disqualifiés sans toucher aux autres", () => {
    expect(codecsRetenus(["truehd"], ["aac", "eac3", "truehd"])).toEqual(["aac", "eac3"]);
  });

  it("rend la liste telle quelle quand rien n'est disqualifié", () => {
    const codecs = ["aac", "eac3"];
    expect(codecsRetenus([], codecs)).toBe(codecs);
  });
});
