import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * `GET /api/health` répond SANS authentification, à n'importe qui sur le
 * réseau (mobile, TV, suivi de redémarrage). Garde de non-régression de
 * l'audit du chantier SQLite : la configuration de la base n'y paraît jamais —
 * ni l'URL et le mot de passe de l'ancienne MariaDB, ni le chemin du fichier
 * SQLite, de sa copie en cours ou de sa sauvegarde. Le champ `database` venu
 * avec 1.25 n'y dit que le moteur, l'état, la progression en nombres, et le
 * motif d'un échec en un mot d'une liste fermée.
 */

const SECRET = "Pw-audit-7f3c9e";
const SOURCE_URL = `mysql://tentacle:${SECRET}@db-audit:3306/tentacle`;
let dataDir = "";
let body: Record<string, unknown> = {};
let text = "";
let fetchHealth: () => Promise<{ text: string; body: Record<string, unknown> }>;

beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "health-audit-"));
  vi.stubEnv("TENTACLE_DATA_DIR", dataDir);
  vi.stubEnv("DATABASE_URL", SOURCE_URL);
  vi.stubEnv("DB_HOST", "db-audit");
  vi.stubEnv("DB_PASSWORD", SECRET);
  vi.resetModules();
  const { healthRoutes } = await import("../routes/health");
  const { pluginBackendDiag } = await import("../services/pluginBackendLoader");
  // Un module d'extension en échec dont l'erreur cite un chemin et la source : rien ne doit en sortir.
  pluginBackendDiag.loadResults.push({ pluginId: "audit", status: "error", detail: `${dataDir}/plugins/audit — ${SOURCE_URL}` });
  fetchHealth = async () => {
    const app = Fastify();
    await app.register(healthRoutes, { prefix: "/api" });
    const res = await app.inject({ method: "GET", url: "/api/health" });
    await app.close();
    return { text: res.body, body: res.json() as Record<string, unknown> };
  };
  ({ text, body } = await fetchHealth());
});

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(dataDir, { recursive: true, force: true });
});

describe("/api/health — rien de la configuration de la base", () => {
  it("répond", () => {
    expect(body.status).toBe("ok");
  });

  it("ni mot de passe, ni URL, ni hôte de la base source", () => {
    expect(text).not.toContain(SECRET);
    expect(text).not.toMatch(/(mysql|mariadb):\/\//i);
    expect(text).not.toContain("db-audit");
  });

  it("ni fichier de base, ni copie, ni sauvegarde, ni configuration de base", () => {
    expect(text).not.toMatch(/tentacle\.db|\.migrating|\.bak\b|database\.json|db_password/i);
    expect(text).not.toMatch(/"file:/);
  });

  it("ni dossier de données, ni liste des extensions, ni détail d'échec pour un anonyme", () => {
    expect(text).not.toContain(dataDir);
    const diag = body.pluginBackends as Record<string, unknown>;
    expect(Object.keys(diag)).toEqual(["loadResults"]);
    expect(diag.loadResults).toContainEqual({ pluginId: "audit", status: "error" });
  });

  it("pendant une migration en cours puis en échec : toujours rien que des mots-clés et des nombres", async () => {
    const state = await import("../dbMigration/migrationState");
    try {
      state.migrationStarted(Date.now() - 10_000);
      state.migrationProgressed({ tablesDone: 7, tablesTotal: 50, bytesDone: 40, bytesTotal: 100 });
      const migrating = await fetchHealth();
      state.migrationFailed("source_unreachable", Date.now() + 30_000);
      const failed = await fetchHealth();
      for (const next of [migrating, failed]) {
        expect(next.text).not.toContain(SECRET);
        expect(next.text).not.toContain(dataDir);
        expect(next.text).not.toMatch(/tentacle\.db|\.migrating|seer_|server_config/);
        const database = next.body.database as Record<string, unknown>;
        expect(["migrating", "failed"]).toContain(database.state);
        expect(Object.values(database.progress as object).every((v) => typeof v === "number" || v === null)).toBe(true);
      }
    } finally {
      state.migrationFinished();
    }
  });

  it("le champ `database`, s'il est là, ne dit que moteur, état, progression et motif", () => {
    const database = body.database as Record<string, unknown> | undefined;
    if (database === undefined) return;
    const allowed = ["engine", "state", "progress", "reason", "retryInSeconds"];
    expect(Object.keys(database).filter((key) => !allowed.includes(key))).toEqual([]);
    if (database.retryInSeconds !== undefined) expect(typeof database.retryInSeconds).toBe("number");
    for (const key of ["engine", "state", "reason"] as const) {
      if (database[key] === undefined) continue;
      // Un mot-clé court, jamais un chemin ni un message d'erreur.
      expect(String(database[key])).toMatch(/^[a-z][a-zA-Z0-9_-]{0,31}$/);
    }
    const progress = database.progress;
    if (progress === undefined || progress === null) return;
    // Des NOMBRES seulement : aucun nom de table (d'une extension inconnue, par exemple).
    const values = typeof progress === "object" ? Object.values(progress as object) : [progress];
    expect(values.every((value) => typeof value === "number" || value === null)).toBe(true);
  });
});
