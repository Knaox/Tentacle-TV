/**
 * Le SERVEUR vu de l'administration : Jellyfin et la base (`/api/admin/services`), la clé
 * d'administration, la carte « Serveur Tentacle », la migration de la base, `/api/health`.
 * Trois états (`labViews.ts` › `state`) : `healthy` (tout va bien), `broken` (la clé refusée et
 * une mise à jour obligatoire), `advice` (rien de cassé, une mise à jour conseillée).
 * Formes : `components/admin/services/servicesModel.ts`, `serverUpdateContract.ts` (shared),
 * `notices/adminKeyHealth.ts` (les champs `etat` / `verifieA` SONT le contrat, en français).
 */

import type { ServerUpdateReport } from "@tentacle-tv/shared";
import type { LabRoute } from "../labFetch";
import { labAgo } from "./accountPairing";

export type AdminState = "healthy" | "broken" | "advice" | "empty";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const BOOT_ID = "lab-boot-7f3a";

/** L'adresse par laquelle le serveur joint son Jellyfin (un nom du réseau de la pile). */
export const JELLYFIN_INTERNAL_URL = "http://jellyfin:8096";
export const JELLYFIN_VERSION = "10.11.6";

function services(state: AdminState) {
  const database = {
    status: "connected", version: "3.46.1", engine: "sqlite", path: "/app/data/tentacle.db", sizeBytes: 48_300_032, storage: "local",
    error: null, pendingRestart: false,
  };
  if (state === "broken") {
    // Jellyfin répond, mais refuse la clé : 401 sur `/System/Info`.
    return {
      jellyfin: {
        status: "error", url: JELLYFIN_INTERNAL_URL, version: "", serverName: "", apiKeyConfigured: true,
        error: "jellyfin-rejected", httpStatus: 401, health: { state: "up" },
      },
      database,
    };
  }
  return {
    jellyfin: {
      status: "connected", url: JELLYFIN_INTERNAL_URL, version: JELLYFIN_VERSION, serverName: "Médiathèque de la maison",
      apiKeyConfigured: true, health: { state: "up" },
    },
    database,
  };
}

const RELEASE_NOTES = {
  fr: [
    "« Tendances actuelles » en tête de « Pour vous »",
    "Watch Together : l'adhésion par appareil",
    "Bandes-annonces : jamais une voix de synthèse",
  ],
  en: [
    "“Trending now” at the top of “For you”",
    "Watch Together: per-device membership",
    "Trailers: never a synthetic voice",
  ],
};

/** `current` et ce que les clients exigent, par état : à jour, obligatoire (sous l'exigence), conseillée. */
const VERSIONS: Record<AdminState, { current: string; behind: number; required: string }> = {
  healthy: { current: "1.41.0", behind: 0, required: "1.23.0" },
  empty: { current: "1.41.0", behind: 0, required: "1.23.0" },
  broken: { current: "1.38.2", behind: 5, required: "1.40.0" },
  advice: { current: "1.40.2", behind: 1, required: "1.23.0" },
};

function serverUpdate(state: AdminState): ServerUpdateReport {
  const { current, behind, required } = VERSIONS[state];
  return {
    current,
    bootId: BOOT_ID,
    latest: {
      version: "1.41.0",
      tag: "server-v1.41.0",
      publishedAt: labAgo(6 * DAY),
      url: "https://github.com/knaox/tentacle-tv/releases/tag/server-v1.41.0",
      highlights: RELEASE_NOTES,
    },
    behind,
    requiredByClients: required,
    checkedAt: labAgo(47 * MINUTE),
    error: null,
    install: { runtime: "docker", repository: "ghcr.io/knaox/tentacle-tv", tag: "latest" },
  };
}

/** Un serveur né sur SQLite : aucune ancienne base, rien à migrer ni à retirer. */
const MIGRATION = {
  legacy: "none",
  sourceConfigured: false,
  report: null,
  cache: { phase: "none", percent: 0 },
  sourceCheck: null,
  removal: { kind: "unknown", stack: null, newStack: null, dbService: null, origin: null, database: "", containerized: true, dropCommand: null, forgetCommand: null },
};

function health() {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    bootId: BOOT_ID,
    pluginBackends: { loadResults: [{ pluginId: "seer", status: "loaded" }, { pluginId: "octave", status: "loaded" }] },
    jellyfin: { state: "up", since: Date.now() - 9 * DAY },
    database: { engine: "sqlite", state: "ready" },
  };
}

export function serverRoutes(state: AdminState): readonly LabRoute[] {
  const keyState = state === "broken" ? "revoquee" : "ok";
  return [
    { path: "/api/health", reply: health },
    // La sonde de connectivité, après `/api/health` : Jellyfin par le proxy (l'`Id` fait foi).
    {
      path: "/api/jellyfin/System/Info/Public",
      reply: {
        LocalAddress: JELLYFIN_INTERNAL_URL, ServerName: "Médiathèque de la maison", Version: JELLYFIN_VERSION, ProductName: "Jellyfin Server",
        OperatingSystem: "Linux", Id: "0f1e2d3c4b5a69788796a5b4c3d2e1f0", StartupWizardCompleted: true,
      },
    },
    { path: "/api/admin/services", reply: () => services(state) },
    { path: "/api/admin/jellyfin-key", reply: () => ({ etat: keyState, verifieA: labAgo(2 * MINUTE) }) },
    { path: "/api/admin/server-update", reply: () => serverUpdate(state) },
    { path: "/api/admin/database/migration", reply: MIGRATION },
    { method: "POST", path: "/api/admin/database/remigrate", reply: { restarting: true } },
    {
      method: "POST", path: "/api/admin/test-jellyfin",
      reply: { version: JELLYFIN_VERSION, serverName: "Médiathèque de la maison" },
    },
    { method: "PUT", path: "/api/admin/jellyfin", reply: { success: true } },
    { method: "POST", path: "/api/admin/reset-server", reply: { success: true } },
    { method: "POST", path: "/api/admin/library/rescan", reply: { started: true } },
  ];
}
