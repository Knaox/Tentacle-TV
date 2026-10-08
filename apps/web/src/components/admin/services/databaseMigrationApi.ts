import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerCapability } from "@tentacle-tv/api-client";
import type { DatabaseMigrationAttention } from "@tentacle-tv/shared";
import { BACKEND, creds, hdrs } from "../../../pages/adminUtils";

/**
 * La migration MariaDB → SQLite vue de l'administration
 * (`GET /api/admin/database/migration`, serveur 1.25) : lue seulement face à un
 * serveur qui déclare `server.databaseMigration` — un serveur d'avant n'en a pas.
 */
export interface DatabaseMigrationSummary {
  legacy: DatabaseMigrationAttention["legacy"];
  sourceConfigured: boolean;
  report: null | {
    finishedAt: number;
    durationMs: number;
    tables: number;
    rows: number;
    sourceEmpty: boolean;
    sourceVersion: string;
    source: { host: string; port: number; database: string };
    unrecognized: string[];
    retired: string[];
    refused: Array<{ table: string; reason: string }>;
    deferred: string[];
  };
  cache: { phase: "none" | "running" | "done" | "stopped"; percent: number };
  sourceCheck: null | { status: "none" | "unreachable" | "same" } | { status: "changed"; why: "identity" | "data" | "was_empty" };
  removal: {
    kind: string;
    stack: string | null;
    /** La pile d'aujourd'hui qui remplace une pile officielle d'avant ; absent d'un serveur qui ne le dit pas. */
    newStack?: string | null;
    dbService: string | null;
    origin?: "env" | "file" | null;
    database: string;
    containerized: boolean;
    dropCommand: string | null;
    /** Supprimer le fichier de l'ancien assistant, quand c'est lui qui désigne la source. */
    forgetCommand?: string | null;
  };
}

export const DATABASE_MIGRATION_KEY = ["admin", "database-migration"] as const;

const LEGACY = new Set(["none", "pending", "migrated", "never_migrated"]);

/** Lecture défensive : un champ inattendu ne fait pas tomber la page. */
export function readDatabaseMigration(raw: unknown): DatabaseMigrationSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<DatabaseMigrationSummary>;
  if (!LEGACY.has(String(r.legacy)) || !r.cache || !r.removal) return null;
  return r as DatabaseMigrationSummary;
}

async function fetchMigration(): Promise<DatabaseMigrationSummary | null> {
  const res = await fetch(`${BACKEND}/api/admin/database/migration`, { headers: hdrs(), credentials: creds() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return readDatabaseMigration(await res.json());
}

/** `undefined` en attente, `null` sans capacité ou en échec. Relu toutes les 5 s pendant la copie du cache. */
export function useDatabaseMigration(): { data: DatabaseMigrationSummary | null | undefined } {
  const supported = useServerCapability("server.databaseMigration");
  const query = useQuery({
    queryKey: DATABASE_MIGRATION_KEY,
    queryFn: fetchMigration,
    enabled: supported === true,
    staleTime: 0,
    refetchInterval: (q) => (q.state.data?.cache.phase === "running" ? 5000 : false),
  });
  if (supported === false) return { data: null };
  if (supported === undefined || query.isPending) return { data: undefined };
  return { data: query.isError ? null : query.data };
}

/** Ce que la règle du tableau de bord en retient. */
export function migrationAttention(summary: DatabaseMigrationSummary | null | undefined): DatabaseMigrationAttention | null | undefined {
  if (summary === undefined || summary === null) return summary;
  const changed = summary.sourceCheck?.status === "changed" ? summary.sourceCheck.why : null;
  return {
    legacy: summary.legacy,
    sourceConfigured: summary.sourceConfigured,
    sourceChanged: changed,
    // Seulement le marqueur de fin (ou rien à copier) : une copie arrêtée n'est pas finie.
    cacheDone: summary.cache.phase === "done" || summary.cache.phase === "none",
    removal: summary.removal.kind,
  };
}

/** « Migrer à nouveau » : le serveur pose son marqueur et redémarre. */
export function useRemigrate() {
  return useMutation({
    mutationFn: async () => {
      const headers = hdrs();
      delete headers["Content-Type"];
      const res = await fetch(`${BACKEND}/api/admin/database/remigrate`, { method: "POST", headers, credentials: creds() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as { restarting: boolean };
    },
  });
}
