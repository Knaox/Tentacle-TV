import type { FastifyPluginAsync } from "fastify";
import { setupErrorHandler } from "./setupErrors";
import { setupCompleteRoute } from "./routes/completeRoute";
import { setupDatabaseRoute } from "./routes/databaseRoute";
import { setupJellyfinRoutes } from "./routes/jellyfinRoutes";
import { setupLibraryRoutes } from "./routes/libraryRoutes";
import { setupSessionRoutes } from "./routes/sessionRoutes";

/**
 * `/api/setup/*` — l'assistant d'installation. Avant la fin : un code lu dans
 * les journaux, échangé contre une session ; après : 404 pour toujours, sauf
 * `GET /status`. Tout refus est un code (`SetupErrorBody`), jamais un message.
 */
export const setupWizardRoutes: FastifyPluginAsync = async (app) => {
  app.setErrorHandler(setupErrorHandler);
  await app.register(setupSessionRoutes);
  await app.register(setupDatabaseRoute);
  await app.register(setupJellyfinRoutes);
  await app.register(setupLibraryRoutes);
  await app.register(setupCompleteRoute);
};
