/**
 * Cette restitution n'a qu'UNE occasion de fonctionner, chez chaque
 * utilisateur, et elle ne se voit pas en développement : ces tests sont sa
 * seule preuve avant la campagne d'essais.
 */

import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { openInMemory, settingGet } from "./db";
import { CLE_MIGRATION, CLE_TRACE, takeMigrationDump } from "./migrationDump";

const MAINTENANT = 1_700_000_000_000;

/** Écrit la sauvegarde telle que l'app Tauri la produit. */
function poserDump(db: DatabaseSync, profileJson: string): void {
  db.prepare(
    `INSERT INTO session_cache (jellyfin_user_id, profile_json, policy_json, cached_at, expires_at)
     VALUES (?, ?, NULL, ?, ?)`,
  ).run(CLE_MIGRATION, profileJson, MAINTENANT, MAINTENANT);
}

function dumpValide(entries: Record<string, string>): string {
  return JSON.stringify({
    version: 1,
    savedAt: MAINTENANT,
    origin: "http://tauri.localhost",
    userAgent: "Tentacle/Tauri",
    entries,
  });
}

function lignes(db: DatabaseSync): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM session_cache WHERE jellyfin_user_id = ?").get(CLE_MIGRATION);
  return Number(row?.["n"] ?? 0);
}

describe("prise du dump de migration", () => {
  it("rend les cles, retire la ligne et pose la trace", () => {
    const db = openInMemory();
    poserDump(db, dumpValide({ tentacle_token: "abc", tentacle_server_url: "https://tv.exemple" }));

    const prise = takeMigrationDump(db, MAINTENANT);

    expect(prise.etat).toBe("prise");
    if (prise.etat !== "prise") return;
    expect(prise.entries).toEqual({ tentacle_token: "abc", tentacle_server_url: "https://tv.exemple" });
    expect(prise.origine).toBe("http://tauri.localhost");
    // Le dump porte le jeton en clair : il ne reste pas en double dans la base.
    expect(lignes(db)).toBe(0);
    expect(settingGet(db, CLE_TRACE)).toBe(String(MAINTENANT));
  });

  it("ne rejoue jamais deux fois", () => {
    const db = openInMemory();
    poserDump(db, dumpValide({ a: "1" }));

    expect(takeMigrationDump(db, MAINTENANT).etat).toBe("prise");
    expect(takeMigrationDump(db, MAINTENANT).etat).toBe("deja-faite");
  });

  it("ignore un dump ressuscite par l'app Tauri", () => {
    const db = openInMemory();
    poserDump(db, dumpValide({ a: "1" }));
    expect(takeMigrationDump(db, MAINTENANT).etat).toBe("prise");

    // Machine de developpement : l'app Tauri tourne encore et reecrit la
    // sauvegarde. La trace doit suffire a ne pas la rejouer.
    poserDump(db, dumpValide({ a: "perime" }));
    expect(takeMigrationDump(db, MAINTENANT).etat).toBe("deja-faite");
    expect(lignes(db)).toBe(1);
  });

  it("sans sauvegarde, il n'y a rien a faire", () => {
    const db = openInMemory();
    expect(takeMigrationDump(db, MAINTENANT).etat).toBe("aucune");
    expect(settingGet(db, CLE_TRACE)).toBeNull();
  });

  it("une sauvegarde illisible est CONSERVEE, sans trace", () => {
    for (const brut of [
      "pas du json",
      JSON.stringify({ version: 2, entries: {} }),
      JSON.stringify({ version: 1 }),
      JSON.stringify({ version: 1, entries: { a: 42 } }),
    ]) {
      const db = openInMemory();
      poserDump(db, brut);

      const prise = takeMigrationDump(db, MAINTENANT);

      expect(prise.etat, brut).toBe("illisible");
      // Rien n'est detruit et rien n'est marque : un analyseur corrige plus
      // tard doit pouvoir retenter.
      expect(lignes(db), brut).toBe(1);
      expect(settingGet(db, CLE_TRACE), brut).toBeNull();
    }
  });

  it("une session reelle n'est jamais confondue avec la sauvegarde", () => {
    const db = openInMemory();
    db.prepare(
      `INSERT INTO session_cache (jellyfin_user_id, profile_json, policy_json, cached_at, expires_at)
       VALUES ('c2e997cc19afc07f', '{"Name":"damien"}', NULL, ?, ?)`,
    ).run(MAINTENANT, MAINTENANT);

    expect(takeMigrationDump(db, MAINTENANT).etat).toBe("aucune");
    const row = db.prepare("SELECT COUNT(*) AS n FROM session_cache").get();
    expect(Number(row?.["n"] ?? 0)).toBe(1);
  });
});
