import { describe, expect, it } from "vitest";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { defaultSubtitle } from "./useDefaultTracks";

/**
 * Ce que ces cas protègent ne se voit pas : un sous-titre image choisi d'office
 * fait incruster, donc RECOMPRESSER l'image entière. Le film s'affiche, en SDR,
 * pendant que le serveur ré-encode du 4K en silence.
 */

const st = (Index: number, Codec: string, Language: string, IsDefault = false): JfStream =>
  ({ Index, Codec, Language, IsDefault, Type: "Subtitle" }) as JfStream;

describe("sous-titre par défaut", () => {
  it("préfère le texte à l'image, à langue égale, quand l'image coûte cher", () => {
    const streams = [st(2, "subrip", "fra"), st(3, "PGSSUB", "fra", true)];
    expect(defaultSubtitle(streams, true)).toBe(2);
  });

  it("garde l'image quand le client sait la dessiner", () => {
    // Rien ne coûte alors : le PGS est rendu sur un canvas, ou par mpv.
    const streams = [st(2, "subrip", "fra"), st(3, "PGSSUB", "fra", true)];
    expect(defaultSubtitle(streams, false)).toBe(3);
  });

  it("garde l'image quand aucun texte n'existe dans la même langue", () => {
    // L'arbitrage est réel, et il appartient à celui qui regarde : on ne lui
    // retire pas ses sous-titres pour sauver la plage dynamique.
    const streams = [st(2, "subrip", "eng"), st(3, "PGSSUB", "fra", true)];
    expect(defaultSubtitle(streams, true)).toBe(3);
  });

  it("ne devine pas quand la langue manque", () => {
    const streams = [st(2, "subrip", ""), st(3, "PGSSUB", "", true)];
    expect(defaultSubtitle(streams, true)).toBe(3);
  });

  it("ne choisit rien si le fichier ne marque aucun défaut", () => {
    expect(defaultSubtitle([st(2, "subrip", "fra")], true)).toBeNull();
    expect(defaultSubtitle([], true)).toBeNull();
  });

  it("laisse passer un sous-titre texte par défaut sans y toucher", () => {
    const streams = [st(2, "subrip", "fra", true), st(3, "PGSSUB", "fra")];
    expect(defaultSubtitle(streams, true)).toBe(2);
  });
});
