/**
 * L'espace `adminOverview` : les deux langues ont exactement les mêmes clés
 * (une clé oubliée afficherait son nom brut), et chaque entrée que le modèle
 * du tableau de bord peut rendre — chaque identifiant, chaque variante — a
 * son titre et sa phrase, par sa clé propre ou par celle de son identifiant.
 */

import { describe, expect, it } from "vitest";
import en from "./locales/en/adminOverview";
import fr from "./locales/fr/adminOverview";

/** Chaque entrée possible et ses variantes (`null` : sans variante). */
const ENTRIES: Record<string, readonly (string | null)[]> = {
  jellyfinNotConfigured: ["key", "url", "both"],
  jellyfinUnreachable: [null],
  jellyfinKeyRejected: ["revoked", "no-rights"],
  databaseDown: [null],
  jellyfinIncompatible: [null],
  serverUpdateRequired: [null],
  publicUrl: ["missing", "not-https", "not-public", "internal-host", "other-server", "unverified"],
  tmdbKey: [null],
  segmentPlugins: [null, "restart"],
  directPlay: ["off", "mixed-content", "cors-missing", "not-public", "internal-host", "unverified"],
};

const has = (key: string) => key in fr;

describe("vocabulaire de la vue d'ensemble", () => {
  it("le français et l'anglais ont les mêmes clés", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });

  it("chaque entrée a son titre et sa phrase, variante par variante", () => {
    for (const [id, variants] of Object.entries(ENTRIES)) {
      for (const variant of variants) {
        for (const part of ["title", "body"]) {
          const own = variant ? `entry_${id}_${variant}_${part}` : null;
          expect(own !== null && has(own) ? true : has(`entry_${id}_${part}`), `${id}/${String(variant)}/${part}`).toBe(true);
        }
      }
    }
    expect(has("entry_jellyfin_title_one") && has("entry_jellyfin_title_other") && has("entry_jellyfin_body")).toBe(true);
  });

  it("chaque état de la carte du serveur a son mot", () => {
    for (const status of ["up-to-date", "advised", "mandatory", "ahead", "unknown"]) expect(has(`serverState_${status}`)).toBe(true);
    for (const error of ["unreachable", "rate-limited", "invalid", "off"]) expect(has(`serverCheckError_${error}`)).toBe(true);
  });

  it("aucun texte vide", () => {
    for (const value of [...Object.values(fr), ...Object.values(en)]) expect(value.trim()).not.toBe("");
  });
});
