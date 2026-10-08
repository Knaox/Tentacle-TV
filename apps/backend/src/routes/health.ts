import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { pluginBackendDiag } from "../services/pluginBackendLoader";
import { BOOT_ID } from "../services/pluginRestart";
import { jellyfinHealth } from "../services/jellyfinHealth";
import { getTokenFromRequest, validateToken } from "../middleware/auth";
import { publicDatabaseState } from "../dbMigration/migrationState";

/** Un admin connecté voit le détail d'un module d'extension en échec ; jamais plus d'1 s d'attente. */
async function isAdminCaller(request: FastifyRequest): Promise<boolean> {
  const token = getTokenFromRequest(request);
  if (!token) return false;
  const verdict = validateToken(token).then((r) => r.ok && r.user.isAdmin).catch(() => false);
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1000).unref());
  return Promise.race([verdict, timeout]);
}

/**
 * Le diagnostic PUBLIC des modules serveur d'extensions : leur identifiant et
 * leur état, que le suivi de redémarrage du web lit (`admin-plugins/pluginApi.ts`).
 * Le dossier de données et la liste des extensions installées n'avaient aucun
 * lecteur : ils ne sortent plus. Le `detail` d'un échec (une pile d'erreur) ne
 * va qu'à un administrateur authentifié (audit S5).
 */
export function publicPluginDiag(admin: boolean) {
  return {
    loadResults: pluginBackendDiag.loadResults.map(({ pluginId, status, detail }) =>
      admin && detail ? { pluginId, status, detail } : { pluginId, status },
    ),
  };
}

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async (request) => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      // Un identifiant par processus : l'administration des plugins reconnaît
      // à son changement le serveur revenu d'un redémarrage.
      bootId: BOOT_ID,
      pluginBackends: publicPluginDiag(await isAdminCaller(request)),
      // L'état de Jellyfin vu d'ici (`jellyfinHealth.ts`) — pour un lecteur
      // sans canal de session : `up`, `restarting`, `shutting-down`, `down`, `starting`.
      jellyfin: jellyfinHealth(),
      // La base (additif, 1.25) : `ready`, ou `migrating` / `failed` pendant le
      // passage de MariaDB à SQLite — l'écran d'attente des clients s'en sert.
      database: publicDatabaseState(),
    };
  });
};
