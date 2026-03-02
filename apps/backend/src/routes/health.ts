import type { FastifyPluginAsync } from "fastify";
import { pluginBackendDiag } from "../services/pluginBackendLoader";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      pluginBackends: pluginBackendDiag,
    };
  });
};
