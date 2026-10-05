import type { FastifyPluginAsync } from "fastify";
import { pluginBackendDiag } from "../services/pluginBackendLoader";
import { BOOT_ID } from "../services/pluginRestart";
import { jellyfinHealth } from "../services/jellyfinHealth";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      // Un identifiant par processus : l'administration des plugins reconnaît
      // à son changement le serveur revenu d'un redémarrage.
      bootId: BOOT_ID,
      pluginBackends: pluginBackendDiag,
      // L'état de Jellyfin vu d'ici (`jellyfinHealth.ts`) — pour un lecteur
      // sans canal de session : `up`, `restarting`, `shutting-down`, `down`, `starting`.
      jellyfin: jellyfinHealth(),
    };
  });
};
