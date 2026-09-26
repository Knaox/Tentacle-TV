import type { FastifyPluginAsync } from "fastify";
import { pluginBackendDiag } from "../services/pluginBackendLoader";
import { BOOT_ID } from "../services/pluginRestart";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      // Un identifiant par processus : l'administration des plugins reconnaît
      // à son changement le serveur revenu d'un redémarrage.
      bootId: BOOT_ID,
      pluginBackends: pluginBackendDiag,
    };
  });
};
