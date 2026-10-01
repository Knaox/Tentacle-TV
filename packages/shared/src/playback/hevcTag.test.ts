import { describe, expect, it } from "vitest";
import { avPlayerHevcTagCondition, avPlayerReadsHevcTag, hevcTagUnreadable } from "./hevcTag";

describe("avPlayerReadsHevcTag — ce qu'AVFoundation affiche tel quel", () => {
  it("`hvc1` (paramètres dans l'entrée) : lu tel quel", () => {
    expect(avPlayerReadsHevcTag("hvc1")).toBe(true);
  });

  it("`dvh1` (Dolby Vision sur une base `hvc1`) : lu tel quel", () => {
    expect(avPlayerReadsHevcTag("dvh1")).toBe(true);
  });

  it("`hev1` : image noire sans erreur — jamais tel quel", () => {
    expect(avPlayerReadsHevcTag("hev1")).toBe(false);
  });

  it("`dvhe` (Dolby Vision sur une base `hev1`) : jamais tel quel", () => {
    expect(avPlayerReadsHevcTag("dvhe")).toBe(false);
  });

  it("une étiquette inconnue (scan ancien, champ absent) ne prouve rien", () => {
    expect(avPlayerReadsHevcTag(undefined)).toBe(false);
    expect(avPlayerReadsHevcTag(null)).toBe(false);
    expect(avPlayerReadsHevcTag("")).toBe(false);
  });

  it("la casse et les blancs de Jellyfin ne changent rien", () => {
    expect(avPlayerReadsHevcTag("HVC1")).toBe(true);
    expect(avPlayerReadsHevcTag(" hvc1 ")).toBe(true);
  });
});

describe("hevcTagUnreadable — le flux que le lecteur AVFoundation ne doit pas recevoir tel quel", () => {
  it("un HEVC `hev1` (Jellyfin dit « hevc » ou « h265 »)", () => {
    expect(hevcTagUnreadable({ Codec: "hevc", CodecTag: "hev1" })).toBe(true);
    expect(hevcTagUnreadable({ Codec: "H265", CodecTag: "hev1" })).toBe(true);
  });

  it("un HEVC sans étiquette (MKV, scan ancien)", () => {
    expect(hevcTagUnreadable({ Codec: "hevc" })).toBe(true);
  });

  it("un HEVC `hvc1` ou `dvh1` passe", () => {
    expect(hevcTagUnreadable({ Codec: "hevc", CodecTag: "hvc1" })).toBe(false);
    expect(hevcTagUnreadable({ Codec: "hevc", CodecTag: "dvh1" })).toBe(false);
  });

  it("un autre codec n'est pas concerné, quelle que soit son étiquette", () => {
    expect(hevcTagUnreadable({ Codec: "h264", CodecTag: "avc1" })).toBe(false);
    expect(hevcTagUnreadable({ Codec: "h264" })).toBe(false);
    expect(hevcTagUnreadable({ Codec: "av1", CodecTag: "av01" })).toBe(false);
  });

  it("pas de flux vidéo : rien à dire", () => {
    expect(hevcTagUnreadable(undefined)).toBe(false);
    expect(hevcTagUnreadable(null)).toBe(false);
  });
});

describe("avPlayerHevcTagCondition — la règle dite au serveur", () => {
  it("n'accepte que les étiquettes lues telles quelles, l'inconnue comprise", () => {
    expect(avPlayerHevcTagCondition()).toEqual({
      Condition: "EqualsAny",
      Property: "VideoCodecTag",
      Value: "hvc1|dvh1",
      IsRequired: true,
    });
  });

  it("la liste du serveur est celle de la règle du client", () => {
    for (const tag of avPlayerHevcTagCondition().Value.split("|")) {
      expect(avPlayerReadsHevcTag(tag)).toBe(true);
    }
  });

  it("chaque appel rend un objet neuf : un profil qui le modifie n'atteint pas les autres", () => {
    expect(avPlayerHevcTagCondition()).not.toBe(avPlayerHevcTagCondition());
  });
});
