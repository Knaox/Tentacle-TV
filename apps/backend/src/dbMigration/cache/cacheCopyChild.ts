import { runCacheCopy } from "./cacheCopyRun";
import type { CacheChildConfig, CacheChildMessage } from "./cacheCopyProtocol";

/**
 * L'entrée du processus ENFANT de la copie de fond du cache TMDB
 * (`cacheCopyRun.ts`). La configuration arrive par le canal IPC, jamais en
 * argument : le mot de passe de la source ne doit pas paraître dans `ps`.
 */
function send(message: CacheChildMessage): void {
  process.send?.(message);
}

process.once("message", (config: CacheChildConfig) => {
  runCacheCopy(config, send)
    .catch((err: unknown) => {
      const code = (err as { code?: unknown })?.code;
      send({ kind: "stopped", reason: typeof code === "string" ? code : "error" });
    })
    .finally(() => process.disconnect?.());
});

// Le serveur qui l'a lancé disparaît (arrêt, redémarrage, remigration) : on s'arrête
// aussitôt, jamais un orphelin qui écrirait encore dans une base (ou un .bak).
process.on("disconnect", () => process.exit(0));
