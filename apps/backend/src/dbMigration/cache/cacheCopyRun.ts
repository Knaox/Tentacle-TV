import type { DatabaseSync } from "node:sqlite";
import { openSqlite } from "../../services/database/nodeSqlite";
import { MariadbReader } from "../legacySource/mariadbReader";
import { coreModels } from "../copy/coreModels";
import { convertRow } from "../copy/tableCopy";
import { corePlan, extensionPlan, type PlanContext } from "../copy/tablePlans";
import { quoteIdent } from "../legacySource/extensionDdl";
import { CACHE_CURSOR_KEY, CACHE_DONE_KEY, type CacheChildConfig, type CacheChildMessage } from "./cacheCopyProtocol";

/**
 * Le cœur de la copie EN FOND du cache TMDB — lancé dans un PROCESSUS ENFANT
 * (`cacheCopyChild.ts`) : `node:sqlite` n'ouvre jamais `tentacle.db` dans le
 * processus qui tient Prisma (DECISION.md § 8) ; d'un processus à l'autre, les
 * verrous de SQLite se voient.
 *
 * Ménagée : des lots courts, une transaction chacun (`INSERT OR IGNORE` — la
 * ligne déjà écrite par le serveur vivant gagne), une pause entre deux. Le
 * curseur (dernière clé copiée) s'écrit dans la MÊME transaction que son lot :
 * un arrêt reprend juste après. Le marqueur de fin n'est posé qu'à la fin.
 * La configuration arrive par le canal IPC, jamais en argument (le mot de passe
 * de la source ne doit pas paraître dans `ps`).
 */
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function readCursor(db: DatabaseSync): { table: string; after: unknown[] } | null {
  const row = db.prepare(`SELECT "value" FROM "server_config" WHERE "key" = ?`).get(CACHE_CURSOR_KEY) as { value?: string } | undefined;
  try {
    return row?.value ? (JSON.parse(row.value) as { table: string; after: unknown[] }) : null;
  } catch {
    return null;
  }
}

export async function runCacheCopy(config: CacheChildConfig, send: (message: CacheChildMessage) => void): Promise<void> {
  const reader = await MariadbReader.open(config.url);
  const db = openSqlite(config.path);
  try {
    const tables = new Map((await reader.tables()).map((t) => [t.name, t]));
    const models = new Map(coreModels().map((m) => [m.table, m]));
    const ctx: PlanContext = { sourceZone: reader.sourceZone, startedAt: Date.now(), zeroDates: new Map() };
    const upsert = db.prepare(`INSERT INTO "server_config" ("key", "value") VALUES (?, ?) ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"`);
    const cursor = readCursor(db);
    for (const name of config.tables) {
      const source = tables.get(name);
      if (!source) continue;
      const model = models.get(name);
      const plan = model ? corePlan(model, source, ctx) : extensionPlan(source, ctx);
      const columns = plan.columns.map((c) => quoteIdent(c.target));
      const insert = db.prepare(
        `INSERT OR IGNORE INTO ${quoteIdent(name)} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
      );
      const keys = source.keyColumns.map((k) => plan.sourceColumns.findIndex((c) => c.name === k && !c.fromZone));
      const total = await reader.count(name);
      let after: unknown[] | null = cursor?.table === name ? cursor.after : null;
      let done = after ? await reader.countBefore(source, after) : 0;
      send({ kind: "progress", table: name, done, total });
      for (;;) {
        const page = await reader.page(source, plan.sourceColumns, { after }, config.batchRows);
        if (page.length === 0) break;
        after = keys.map((i) => page[page.length - 1][i]);
        db.exec("BEGIN IMMEDIATE");
        try {
          for (const raw of page) {
            const row = convertRow(plan, raw);
            insert.run(...(plan.columns.map((c) => row[c.target]) as never[]));
          }
          upsert.run(CACHE_CURSOR_KEY, JSON.stringify({ table: name, after }));
          db.exec("COMMIT");
        } catch (err) {
          db.exec("ROLLBACK");
          throw err;
        }
        done += page.length;
        send({ kind: "progress", table: name, done, total });
        if (page.length < config.batchRows) break;
        await sleep(config.pauseMs);
      }
    }
    db.exec("BEGIN IMMEDIATE");
    upsert.run(CACHE_DONE_KEY, String(Date.now()));
    db.prepare(`DELETE FROM "server_config" WHERE "key" = ?`).run(CACHE_CURSOR_KEY);
    db.exec("COMMIT");
    send({ kind: "done" });
  } finally {
    db.close();
    await reader.close().catch(() => undefined);
  }
}

