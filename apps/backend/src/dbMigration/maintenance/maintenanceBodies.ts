import type { FastifyRequest } from "fastify";
import { BOOT_ID } from "../../services/pluginRestart";
import { jellyfinHealth } from "../../services/jellyfinHealth";
import { BACKEND_VERSION } from "../../services/version";
import { declaredServerCapabilities } from "../../serverCapabilities/declaredCapabilities";
import { publicDatabaseState } from "../migrationState";

/**
 * Ce que le serveur de maintenance répond SANS base : tiré du code et de l'état
 * en mémoire, jamais d'une requête. Mêmes champs que d'habitude là où un client
 * livré les lit (`status`, `bootId`, `capabilities`…), le reste absent.
 */
export function maintenanceHealthBody(_request?: FastifyRequest): Record<string, unknown> {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    bootId: BOOT_ID,
    // Aucune extension n'est chargée pendant une migration.
    pluginBackends: { loadResults: [] },
    jellyfin: jellyfinHealth(),
    database: publicDatabaseState(),
  };
}

export function maintenanceConfigBody(_request?: FastifyRequest): Record<string, unknown> {
  return {
    version: BACKEND_VERSION,
    brandName: "Tentacle TV",
    // Rien de ce qui se lit en base : pas de Famille, pas d'adresses, pas de lien public.
    features: { downloads: false, demo: process.env.DEMO_MODE === "true" },
    // La capacité `server.databaseMigration` y est : les clients à jour montrent l'écran d'attente.
    capabilities: declaredServerCapabilities(),
    publicUrl: null,
    database: publicDatabaseState(),
  };
}
