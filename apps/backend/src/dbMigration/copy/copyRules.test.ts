import { describe, expect, it } from "vitest";
import { classifyTables } from "./tableClassification";
import { judgeSource, OLDEST_SOURCE_VERSION } from "../legacySource/sourceFloor";
import { legacyRowFilter, MIGRATION_REPORT_KEY } from "../transforms/legacyRows";
import { sanitizeError } from "../migrationErrors";

const CORE = ["server_config", "share_links", "provisioning_codes", "notifications", "paired_devices"];
const TARGET = [...CORE, "core_migrations"];

describe("classement des tables de la source", () => {
  it("cœur, extension, ancien cœur", () => {
    const fates = classifyTables(["server_config", "seer_requests", "anime_id_map", "media_audio_fingerprint"], CORE, TARGET);
    expect(fates).toEqual([
      { name: "server_config", fate: "core" },
      { name: "seer_requests", fate: "extension" },
      { name: "anime_id_map", fate: "retired" },
      { name: "media_audio_fingerprint", fate: "retired" },
    ]);
  });

  it("une table d'extension qui prendrait le nom d'une table de la cible (casse ignorée) est REFUSÉE", () => {
    const fates = classifyTables(["Server_Config", "CORE_MIGRATIONS", "sqlite_sequence", "Plugin_Migrations"], CORE, TARGET);
    expect(fates.map((f) => [f.name, f.fate, "reason" in f ? f.reason : null])).toEqual([
      ["Server_Config", "refused", "name_collision"],
      ["CORE_MIGRATIONS", "refused", "host_table"],
      ["sqlite_sequence", "refused", "name_collision"],
      ["Plugin_Migrations", "refused", "host_table"],
    ]);
  });

  it("les tables de suivi de l'hôte ne viennent JAMAIS d'une source, même sous leur nom exact", () => {
    const fates = classifyTables(["core_migrations", "plugin_migrations"], [...CORE, "plugin_migrations"], TARGET);
    expect(fates.every((f) => f.fate === "refused")).toBe(true);
  });

  it("deux tables de la source qui ne diffèrent que par la casse : refusées toutes les deux", () => {
    const fates = classifyTables(["ext_items", "EXT_items", "server_config"], CORE, TARGET);
    expect(fates.filter((f) => f.fate === "refused").map((f) => f.name)).toEqual(["ext_items", "EXT_items"]);
    expect(fates.find((f) => f.name === "server_config")?.fate).toBe("core");
  });
});

describe(`plancher : une source d'au moins ${OLDEST_SOURCE_VERSION}`, () => {
  it("une 1.4.0 (ses onze tables) est reprise", () => {
    const v140 = ["invite_keys", "invite_usages", "support_tickets", "ticket_messages", "notifications", "library_preferences",
      "server_config", "pairing_codes", "provisioning_codes", "paired_devices", "share_links"];
    expect(judgeSource(v140, CORE)).toEqual({ kind: "supported" });
  });

  it("d'avant core-init.sql (ni share_links ni provisioning_codes) : trop ancienne, dite telle", () => {
    expect(judgeSource(["server_config", "paired_devices", "notifications"], CORE)).toEqual({
      kind: "too_old",
      missing: ["share_links", "provisioning_codes"],
    });
  });

  it("aucune table du cœur (installation jamais faite, ou base d'un autre logiciel) : vide", () => {
    expect(judgeSource([], CORE)).toEqual({ kind: "empty" });
    expect(judgeSource(["wp_posts"], CORE)).toEqual({ kind: "empty" });
  });
});

describe("purges de core-init.sql rejouées pendant la copie", () => {
  const config = legacyRowFilter("server_config")!;
  it("clés abandonnées écartées, les autres gardées", () => {
    expect(config({ key: "theme_active_css_content", value: "x" })).toBe(false);
    expect(config({ key: "anilist_client_secret", value: "x" })).toBe(false);
    expect(config({ key: "jwt_secret", value: "x" })).toBe(true);
  });

  it("une source qui porte déjà la clé du rapport de migration ne la fait JAMAIS passer", () => {
    expect(config({ key: MIGRATION_REPORT_KEY, value: "{}" })).toBe(false);
  });

  it("les comptes AniList partent, les autres restent", () => {
    const ext = legacyRowFilter("external_accounts")!;
    expect(ext({ provider: "anilist" })).toBe(false);
    expect(ext({ provider: "tmdb" })).toBe(true);
    expect(legacyRowFilter("notifications")).toBeUndefined();
  });
});

describe("journal [db-migration] : jamais une valeur de ligne (audit S9)", () => {
  it("les littéraux cités par un pilote sont masqués, le code d'erreur gardé", () => {
    const err = Object.assign(new Error("Duplicate entry 'cle-secrete-42' for key 'PRIMARY'"), { code: "ER_DUP_ENTRY" });
    const text = sanitizeError(err);
    expect(text).toContain("ER_DUP_ENTRY");
    expect(text).not.toContain("cle-secrete-42");
    expect(sanitizeError(new Error('UNIQUE constraint failed: "a@b.c"'))).not.toContain("a@b.c");
  });
});
