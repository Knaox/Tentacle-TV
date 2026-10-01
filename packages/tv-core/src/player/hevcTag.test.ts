import { describe, expect, it } from "vitest";
import { avPlayerReadsHevcTag } from "./hevcTag";

describe("avPlayerReadsHevcTag — ce qu'AVPlayer affiche tel quel", () => {
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
