import { describe, expect, it } from "vitest";
import type { LinkCheck } from "../serverLinks/serverLinksVerdict";
import { SERVER_CAPABILITY_KEYS } from "../serverCapabilities/serverCapabilities";
import { buildAdminAttention, type AttentionSources, type DatabaseMigrationAttention } from "./attentionModel";

const done = (id: LinkCheck["id"]): LinkCheck => ({ id, state: "done", endpoints: [], notes: [] });
const healthy: AttentionSources = {
  jellyfin: { state: "connected" },
  adminKey: "ok",
  databaseDown: false,
  tmdbConfigured: true,
  links: [done("publicUrl"), done("directPlay")],
  jellyfinSetup: { restartPending: false, checks: [] },
  jellyfinVersion: "compatible",
  serverUpdate: "up-to-date",
  refusedExtensions: [],
  capabilities: new Set(SERVER_CAPABILITY_KEYS),
  dismissed: { publicUrl: false, tmdbKey: false, jellyfin: false, segmentPlugins: false, directPlay: false, removeMariadb: false },
};
const migrated: DatabaseMigrationAttention = { legacy: "migrated", sourceConfigured: true, sourceChanged: null, cacheDone: true, removal: "external" };

describe("la migration de la base dans le tableau de bord", () => {
  it("migrée, cache copié, MariaDB encore configurée : « MariaDB n'est plus nécessaire », avec l'installation détectée", () => {
    const attention = buildAdminAttention({ ...healthy, databaseMigration: migrated });
    expect(attention.blocking).toEqual([]);
    expect(attention.recommendations).toEqual([{ id: "removeMariadb", hint: "adminRemoveMariadb", variant: "external", items: [] }]);
  });

  it("pas avant la fin de la copie du cache, ni une fois MariaDB retirée", () => {
    expect(buildAdminAttention({ ...healthy, databaseMigration: { ...migrated, cacheDone: false } }).recommendations).toEqual([]);
    expect(buildAdminAttention({ ...healthy, databaseMigration: { ...migrated, sourceConfigured: false } }).recommendations).toEqual([]);
  });

  it("l'ancienne base a changé depuis la migration : « À régler », et rien à retirer tant que c'est le cas", () => {
    const attention = buildAdminAttention({ ...healthy, databaseMigration: { ...migrated, sourceChanged: "data" } });
    expect(attention.blocking).toEqual([{ id: "databaseSourceChanged", variant: "data", items: [] }]);
    expect(attention.recommendations).toEqual([]);
  });

  it("une base installée sans jamais avoir été migrée face à une MariaDB configurée : « À régler »", () => {
    const attention = buildAdminAttention({ ...healthy, databaseMigration: { ...migrated, legacy: "never_migrated" } });
    expect(attention.blocking.map((e) => e.id)).toEqual(["databaseNeverMigrated"]);
  });

  it("serveur d'avant 1.25 (null) ou appelant d'avant (absent) : rien, et l'état se dit quand même", () => {
    expect(buildAdminAttention({ ...healthy, databaseMigration: null })).toMatchObject({ settled: true, blocking: [], recommendations: [] });
    expect(buildAdminAttention({ ...healthy, databaseMigration: undefined }).settled).toBe(false);
  });

  it("masquée par le compte : sous « masquées »", () => {
    const attention = buildAdminAttention({ ...healthy, databaseMigration: migrated, dismissed: { ...healthy.dismissed, removeMariadb: true } });
    expect(attention.hidden.map((e) => e.id)).toEqual(["removeMariadb"]);
  });
});
