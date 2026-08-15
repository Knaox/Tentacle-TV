import { describe, expect, it } from "vitest";
import type { AudioTrack } from "../components/player/videoPlayer.types";
import { apparier, rangDe, type PisteNative } from "./appariementPistes";
import { memeLangue, normaliserLangue } from "./languesIso";

/**
 * Le cas de référence est mesuré, pas imaginé : LG C3, webOS 25, MKV portant
 * un DTS-HD MA 5.1 français (index Jellyfin 1) et un TrueHD 7.1 Atmos anglais
 * (index 2). Le démultiplexeur ne publie que le premier, sous l'identifiant
 * « 1 » et la langue « fr ». Demander l'anglais doit rendre `null` — c'est ce
 * `null` qui déclenche la session serveur, et son absence était le défaut.
 */

const piste = (index: number, lang?: string, codec?: string): AudioTrack =>
  ({ index, label: `piste ${index}`, lang, codec }) as AudioTrack;

const natif = (id?: string, language?: string): PisteNative => ({ id, language });

describe("normaliserLangue", () => {
  it("rapproche les trois orthographes d'une même langue", () => {
    expect(normaliserLangue("fra")).toBe("fr");
    expect(normaliserLangue("fre")).toBe("fr");
    expect(normaliserLangue("FR")).toBe("fr");
  });

  it("laisse tomber la sous-étiquette de région ou d'écriture", () => {
    expect(normaliserLangue("pt-BR")).toBe("pt");
    expect(normaliserLangue("zh_Hans")).toBe("zh");
  });

  it("rend null sur ce qui ne désigne aucune langue", () => {
    for (const brute of [undefined, null, "", "  ", "und", "mul", "zxx"]) {
      expect(normaliserLangue(brute)).toBeNull();
    }
  });

  it("rend inchangé un code absent de la table", () => {
    expect(normaliserLangue("haw")).toBe("haw");
  });

  it("ne fait jamais correspondre deux absences", () => {
    expect(memeLangue("und", "und")).toBe(false);
    expect(memeLangue("fre", "fra")).toBe(true);
  });
});

describe("apparier — par identifiant", () => {
  it("le cas mesuré : la piste non démultiplexée n'a pas de rang", () => {
    const natives = [natif("1", "fr")];
    const pistes = [piste(1, "fra"), piste(2, "eng")];
    expect(apparier(natives, pistes)).toEqual([0, null]);
  });

  it("suit l'identifiant même quand l'ordre serveur diffère", () => {
    const natives = [natif("3", "en"), natif("1", "fr")];
    const pistes = [piste(1, "fra"), piste(3, "eng")];
    expect(apparier(natives, pistes)).toEqual([1, 0]);
  });

  it("renonce à l'identifiant quand un rang natif reste orphelin", () => {
    // « 7 » ne désigne aucune piste annoncée : sur ce moteur l'identifiant ne
    // veut pas dire index de flux. La langue reprend la main et fait le travail.
    const natives = [natif("0", "fr"), natif("7", "en")];
    const pistes = [piste(1, "fra"), piste(2, "eng")];
    expect(apparier(natives, pistes)).toEqual([0, 1]);
  });

  it("renonce à l'identifiant quand il n'est pas numérique", () => {
    const natives = [natif("piste-fr", "fr"), natif("piste-en", "en")];
    expect(apparier(natives, [piste(1, "fra"), piste(2, "eng")])).toEqual([0, 1]);
  });
});

describe("apparier — par langue", () => {
  it("corrige un ordre inversé que le rang aurait manqué", () => {
    const natives = [natif(undefined, "fr"), natif(undefined, "en")];
    const pistes = [piste(1, "eng"), piste(2, "fra")];
    expect(apparier(natives, pistes)).toEqual([1, 0]);
  });

  it("distribue deux pistes de même langue dans l'ordre du fichier", () => {
    const natives = [natif(undefined, "fr"), natif(undefined, "fr")];
    const pistes = [piste(1, "fra"), piste(2, "fra")];
    expect(apparier(natives, pistes)).toEqual([0, 1]);
  });

  it("écarte d'abord ce que le lecteur ne publiera pas", () => {
    // Le cas dur : deux pistes françaises, une seule sortie native. Sans le
    // filtre, la TrueHD prendrait le rang de la DTS et l'on entendrait du DTS.
    const natives = [natif(undefined, "fr")];
    const pistes = [piste(1, "fra", "truehd"), piste(2, "fra", "dts")];
    const publiable = (p: AudioTrack) => p.codec !== "truehd";
    expect(apparier(natives, pistes, publiable)).toEqual([null, 0]);
  });
});

describe("apparier — repli sur le rang", () => {
  it("reprend le comportement d'avant sur un fichier sans langue", () => {
    const natives = [natif(undefined, undefined), natif(undefined, undefined), natif()];
    const pistes = [piste(1), piste(2), piste(3)];
    expect(apparier(natives, pistes)).toEqual([0, 1, 2]);
  });

  it("ne devine rien quand les comptes diffèrent", () => {
    const natives = [natif(), natif()];
    const pistes = [piste(1), piste(2), piste(3)];
    expect(apparier(natives, pistes)).toEqual([null, null, null]);
  });

  it("rend tout null sur une liste native vide", () => {
    expect(apparier([], [piste(1, "fra"), piste(2, "eng")])).toEqual([null, null]);
  });
});

describe("rangDe", () => {
  const pistes = [piste(1, "fra"), piste(2, "eng")];

  it("rend le rang natif de l'index demandé", () => {
    expect(rangDe([0, null], pistes, 1)).toBe(0);
  });

  it("rend null pour une piste sans rang natif", () => {
    expect(rangDe([0, null], pistes, 2)).toBeNull();
  });

  it("rend null pour un index que le serveur n'annonce pas", () => {
    expect(rangDe([0, null], pistes, 99)).toBeNull();
  });
});
