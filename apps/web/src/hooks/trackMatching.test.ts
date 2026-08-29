import { describe, expect, it } from "vitest";
import type { AudioTrack } from "../components/player/videoPlayer.types";
import { matchTracks, rankOf, type NativeTrack } from "./trackMatching";
import { sameLanguage, normalizeLanguage } from "./isoLanguages";

/**
 * Le cas de référence est mesuré, pas imaginé : LG C3, webOS 25, MKV portant
 * un DTS-HD MA 5.1 français (index Jellyfin 1) et un TrueHD 7.1 Atmos anglais
 * (index 2). Le démultiplexeur ne publie que le premier, sous l'identifiant
 * « 1 » et la langue « fr ». Demander l'anglais doit rendre `null` — c'est ce
 * `null` qui déclenche la session serveur, et son absence était le défaut.
 */

const track = (index: number, lang?: string, codec?: string): AudioTrack =>
  ({ index, label: `piste ${index}`, lang, codec }) as AudioTrack;

const natif = (id?: string, language?: string): NativeTrack => ({ id, language });

describe("normaliserLangue", () => {
  it("rapproche les trois orthographes d'une même langue", () => {
    expect(normalizeLanguage("fra")).toBe("fr");
    expect(normalizeLanguage("fre")).toBe("fr");
    expect(normalizeLanguage("FR")).toBe("fr");
  });

  it("laisse tomber la sous-étiquette de région ou d'écriture", () => {
    expect(normalizeLanguage("pt-BR")).toBe("pt");
    expect(normalizeLanguage("zh_Hans")).toBe("zh");
  });

  it("rend null sur ce qui ne désigne aucune langue", () => {
    for (const raw of [undefined, null, "", "  ", "und", "mul", "zxx"]) {
      expect(normalizeLanguage(raw)).toBeNull();
    }
  });

  it("rend inchangé un code absent de la table", () => {
    expect(normalizeLanguage("haw")).toBe("haw");
  });

  it("ne fait jamais correspondre deux absences", () => {
    expect(sameLanguage("und", "und")).toBe(false);
    expect(sameLanguage("fre", "fra")).toBe(true);
  });
});

describe("apparier — par identifiant", () => {
  it("le cas mesuré : la piste non démultiplexée n'a pas de rang", () => {
    const natives = [natif("1", "fr")];
    const tracks = [track(1, "fra"), track(2, "eng")];
    expect(matchTracks(natives, tracks)).toEqual([0, null]);
  });

  it("suit l'identifiant même quand l'ordre serveur diffère", () => {
    const natives = [natif("3", "en"), natif("1", "fr")];
    const tracks = [track(1, "fra"), track(3, "eng")];
    expect(matchTracks(natives, tracks)).toEqual([1, 0]);
  });

  it("renonce à l'identifiant quand un rang natif reste orphelin", () => {
    // « 7 » ne désigne aucune piste annoncée : sur ce moteur l'identifiant ne
    // veut pas dire index de flux. La langue reprend la main et fait le travail.
    const natives = [natif("0", "fr"), natif("7", "en")];
    const tracks = [track(1, "fra"), track(2, "eng")];
    expect(matchTracks(natives, tracks)).toEqual([0, 1]);
  });

  it("renonce à l'identifiant quand il n'est pas numérique", () => {
    const natives = [natif("piste-fr", "fr"), natif("piste-en", "en")];
    expect(matchTracks(natives, [track(1, "fra"), track(2, "eng")])).toEqual([0, 1]);
  });
});

describe("apparier — par langue", () => {
  it("corrige un ordre inversé que le rang aurait manqué", () => {
    const natives = [natif(undefined, "fr"), natif(undefined, "en")];
    const tracks = [track(1, "eng"), track(2, "fra")];
    expect(matchTracks(natives, tracks)).toEqual([1, 0]);
  });

  it("distribue deux pistes de même langue dans l'ordre du fichier", () => {
    const natives = [natif(undefined, "fr"), natif(undefined, "fr")];
    const tracks = [track(1, "fra"), track(2, "fra")];
    expect(matchTracks(natives, tracks)).toEqual([0, 1]);
  });

  it("écarte d'abord ce que le lecteur ne publiera pas", () => {
    // Le cas dur : deux pistes françaises, une seule sortie native. Sans le
    // filtre, la TrueHD prendrait le rang de la DTS et l'on entendrait du DTS.
    const natives = [natif(undefined, "fr")];
    const tracks = [track(1, "fra", "truehd"), track(2, "fra", "dts")];
    const publishable = (p: AudioTrack) => p.codec !== "truehd";
    expect(matchTracks(natives, tracks, publishable)).toEqual([null, 0]);
  });
});

describe("apparier — repli sur le rang", () => {
  it("reprend le comportement d'avant sur un fichier sans langue", () => {
    const natives = [natif(undefined, undefined), natif(undefined, undefined), natif()];
    const tracks = [track(1), track(2), track(3)];
    expect(matchTracks(natives, tracks)).toEqual([0, 1, 2]);
  });

  it("ne devine rien quand les comptes diffèrent", () => {
    const natives = [natif(), natif()];
    const tracks = [track(1), track(2), track(3)];
    expect(matchTracks(natives, tracks)).toEqual([null, null, null]);
  });

  it("rend tout null sur une liste native vide", () => {
    expect(matchTracks([], [track(1, "fra"), track(2, "eng")])).toEqual([null, null]);
  });
});

describe("rangDe", () => {
  const tracks = [track(1, "fra"), track(2, "eng")];

  it("rend le rang natif de l'index demandé", () => {
    expect(rankOf([0, null], tracks, 1)).toBe(0);
  });

  it("rend null pour une piste sans rang natif", () => {
    expect(rankOf([0, null], tracks, 2)).toBeNull();
  });

  it("rend null pour un index que le serveur n'annonce pas", () => {
    expect(rankOf([0, null], tracks, 99)).toBeNull();
  });
});
