/**
 * Cette restitution n'a qu'UNE occasion de fonctionner, chez chaque
 * utilisateur, et elle ne se voit pas en développement : ces tests sont sa
 * seule preuve avant la campagne d'essais.
 */

import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { openInMemory, settingGet } from "./db";
import { MIGRATION_KEY, TRACE_KEY, takeMigrationDump } from "./migrationDump";

const NOW = 1_700_000_000_000;

/** Écrit la sauvegarde telle que l'app Tauri la produit. */
function writeDump(db: DatabaseSync, profileJson: string): void {
  db.prepare(
    `INSERT INTO session_cache (jellyfin_user_id, profile_json, policy_json, cached_at, expires_at)
     VALUES (?, ?, NULL, ?, ?)`,
  ).run(MIGRATION_KEY, profileJson, NOW, NOW);
}

function validDump(entries: Record<string, string>): string {
  return JSON.stringify({
    version: 1,
    savedAt: NOW,
    origin: "http://tauri.localhost",
    userAgent: "Tentacle/Tauri",
    entries,
  });
}

function lines(db: DatabaseSync): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM session_cache WHERE jellyfin_user_id = ?").get(MIGRATION_KEY);
  return Number(row?.["n"] ?? 0);
}

describe("prise du dump de migration", () => {
  it("rend les cles, retire la ligne et pose la trace", () => {
    const db = openInMemory();
    writeDump(db, validDump({ tentacle_token: "abc", tentacle_server_url: "https://tv.exemple" }));

    const take = takeMigrationDump(db, NOW);

    expect(take.state).toBe("prise");
    if (take.state !== "prise") return;
    expect(take.entries).toEqual({ tentacle_token: "abc", tentacle_server_url: "https://tv.exemple" });
    expect(take.origin).toBe("http://tauri.localhost");
    // Le dump porte le jeton en clair : il ne reste pas en double dans la base.
    expect(lines(db)).toBe(0);
    expect(settingGet(db, TRACE_KEY)).toBe(String(NOW));
  });

  it("ne rejoue jamais deux fois", () => {
    const db = openInMemory();
    writeDump(db, validDump({ a: "1" }));

    expect(takeMigrationDump(db, NOW).state).toBe("prise");
    expect(takeMigrationDump(db, NOW).state).toBe("deja-faite");
  });

  it("ignore un dump ressuscite par l'app Tauri", () => {
    const db = openInMemory();
    writeDump(db, validDump({ a: "1" }));
    expect(takeMigrationDump(db, NOW).state).toBe("prise");

    // Machine de developpement : l'app Tauri tourne encore et reecrit la
    // sauvegarde. La trace doit suffire a ne pas la rejouer.
    writeDump(db, validDump({ a: "perime" }));
    expect(takeMigrationDump(db, NOW).state).toBe("deja-faite");
    expect(lines(db)).toBe(1);
  });

  it("sans sauvegarde, il n'y a rien a faire", () => {
    const db = openInMemory();
    expect(takeMigrationDump(db, NOW).state).toBe("aucune");
    expect(settingGet(db, TRACE_KEY)).toBeNull();
  });

  it("une sauvegarde illisible est CONSERVEE, sans trace", () => {
    for (const raw of [
      "pas du json",
      JSON.stringify({ version: 2, entries: {} }),
      JSON.stringify({ version: 1 }),
      JSON.stringify({ version: 1, entries: { a: 42 } }),
    ]) {
      const db = openInMemory();
      writeDump(db, raw);

      const take = takeMigrationDump(db, NOW);

      expect(take.state, raw).toBe("illisible");
      // Rien n'est detruit et rien n'est marque : un analyseur corrige plus
      // tard doit pouvoir retenter.
      expect(lines(db), raw).toBe(1);
      expect(settingGet(db, TRACE_KEY), raw).toBeNull();
    }
  });

  it("une session reelle n'est jamais confondue avec la sauvegarde", () => {
    const db = openInMemory();
    db.prepare(
      `INSERT INTO session_cache (jellyfin_user_id, profile_json, policy_json, cached_at, expires_at)
       VALUES ('c2e997cc19afc07f', '{"Name":"damien"}', NULL, ?, ?)`,
    ).run(NOW, NOW);

    expect(takeMigrationDump(db, NOW).state).toBe("aucune");
    const row = db.prepare("SELECT COUNT(*) AS n FROM session_cache").get();
    expect(Number(row?.["n"] ?? 0)).toBe(1);
  });
});
