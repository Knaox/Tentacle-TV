/**
 * L'espace `adminJellyfin` : les deux langues ont exactement les mêmes clés
 * (une clé oubliée afficherait son nom brut), et chaque réglage recommandé que
 * le serveur peut rendre a son titre et son explication.
 */

import { describe, expect, it } from "vitest";
import en from "./locales/en/adminJellyfin";
import fr from "./locales/fr/adminJellyfin";

const CHECKS = ["metadataTmdb", "metadataLanguage", "trickplay", "segmentsProvider", "realtimeMonitor", "hardwareAcceleration", "chapterImages"];

describe("vocabulaire de Jellyfin dans l'administration", () => {
  it("le français et l'anglais ont les mêmes clés", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });

  it("chaque réglage a son titre et son explication", () => {
    for (const id of CHECKS) {
      expect(fr).toHaveProperty(`check_${id}`);
      expect(fr).toHaveProperty(`why_${id}`);
    }
  });

  it("aucun texte vide", () => {
    for (const value of [...Object.values(fr), ...Object.values(en)]) expect(value.trim()).not.toBe("");
  });
});
