import { afterAll, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { FastifyInstance } from "fastify";

// Une installation d'avant 1.25 : MariaDB configurée, ni tentacle.db, ni setup-complete.
const env = vi.hoisted(() => {
  // Posé avant tout import (le dossier de données se lit au chargement) ; créé plus bas.
  const dir = `${process.env.TMPDIR ?? "/tmp"}/tentacle-bootmig-${process.pid}-${Date.now()}`;
  process.env.TENTACLE_DATA_DIR = dir;
  process.env.DATABASE_URL = "mysql://tentacle:secret@127.0.0.1:1/tentacle";
  return { dir };
});

const prismaClients = vi.hoisted(() => ({ created: 0 }));
vi.mock("@prisma/client", async (importOriginal) => {
  const real = await importOriginal<typeof import("@prisma/client")>();
  class CountingPrismaClient {
    constructor() {
      prismaClients.created++;
    }
  }
  return { ...real, PrismaClient: CountingPrismaClient };
});
const pluginLoader = vi.hoisted(() => ({ loadPluginBackends: vi.fn() }));
vi.mock("../services/pluginBackendLoader", () => ({ loadPluginBackends: pluginLoader.loadPluginBackends, pluginBackendDiag: { loadResults: [] } }));

import { migrateBeforeBoot, migrationPaths } from "./bootMigration";
import { MigrationFailure } from "./migrationErrors";
import { writeStatusFile } from "./migrationLoop";
import { buildMaintenanceServer } from "./maintenance/maintenanceServer";
import { maintenanceConfigBody, maintenanceHealthBody } from "./maintenance/maintenanceBodies";
import { legacySourceState } from "../services/database/legacySource";
import { hasPrisma } from "../services/db";

afterAll(() => rmSync(env.dir, { recursive: true, force: true }));

describe("démarrage avec une migration en attente — pas de bascule à chaud (S2), assistant fermé (S3)", () => {
  it("source INJOIGNABLE : ni Prisma, ni extension, ni code d'installation, l'écran dit l'échec ; puis la reprise aboutit", async () => {
    mkdirSync(env.dir, { recursive: true });
    expect(legacySourceState()).toBe("pending");
    const paths = migrationPaths(env.dir);
    let app: FastifyInstance | null = null;
    const seen: Array<Record<string, unknown>> = [];
    let attempts = 0;
    const run = async () => {
      attempts++;
      if (attempts === 1) throw new MigrationFailure("source_unreachable", "connexion refusée");
      return { kind: "already" as const };
    };
    const sleep = async () => {
      // Pendant l'attente du nouvel essai : ce que voient le monde et le processus.
      const health = (await app!.inject({ method: "GET", url: "/api/health" })).json();
      const local = await app!.inject({ method: "POST", url: "/api/setup/session/local", payload: {} });
      const ws = await app!.inject({ method: "GET", url: "/api/ws", headers: { connection: "upgrade", upgrade: "websocket" } });
      const plugin = await app!.inject({ method: "GET", url: "/api/plugins/active" });
      seen.push({
        prismaClients: prismaClients.created,
        hasPrisma: hasPrisma(),
        pluginsLoaded: pluginLoader.loadPluginBackends.mock.calls.length,
        setupToken: existsSync(join(env.dir, "setup-token.txt")),
        sealed: existsSync(join(env.dir, "setup-complete")),
        database: health.database,
        statuses: [local.statusCode, ws.statusCode, plugin.statusCode],
      });
      writeFileSync(paths.trigger, ""); // l'administrateur lance « tentacle db migrate »
    };
    await migrateBeforeBoot(
      {
        startMaintenance: async () => {
          app = await buildMaintenanceServer({ port: 0, host: "127.0.0.1", healthBody: maintenanceHealthBody, configBody: maintenanceConfigBody });
          return () => app!.close();
        },
        run,
        sleep,
      },
      paths,
    );

    expect(seen.length).toBeGreaterThan(0);
    const during = seen[0];
    expect(during).toMatchObject({
      prismaClients: 0,
      hasPrisma: false,
      pluginsLoaded: 0,
      setupToken: false,
      sealed: false,
      statuses: [503, 503, 503],
    });
    expect(during.database).toMatchObject({ engine: "sqlite", state: "failed", reason: "source_unreachable" });
    // Le déclencheur de la CLI a relancé l'essai, qui a abouti : la bascule est dite au socle.
    expect(attempts).toBe(2);
    expect(legacySourceState()).toBe("migrated");
    expect(prismaClients.created).toBe(0);
    // Le fichier d'état de la CLI est privé.
    expect(existsSync(paths.status)).toBe(true);
  });
});

it("le fichier d'état de la migration naît en 0600", () => {
  const dir = mkdtempSync(join(tmpdir(), "tentacle-status-"));
  // Effacé même si l'assertion échoue : sans finally, un échec laissait le dossier dans /tmp.
  try {
    const file = join(dir, "status.json");
    writeStatusFile(file, { state: "migrating", attempt: 1, updatedAt: 0, percent: 0 });
    expect(statSync(file).mode & 0o777).toBe(0o600);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
