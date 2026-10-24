import type { FastifyInstance } from "fastify";
import { onJellyfinHealth } from "../../services/jellyfinHealth";
import { registerPluginRelay } from "./relay/relayRoute";
import { mayUseIsolatedPlugin } from "./accountRights";
import { configureIsolatedRuntime, type IsolatedRuntimeServices } from "./hostServices";
import { pushJellyfinState, relayLookup, serverLocale, startIsolatedRuntime, stopIsolatedRuntime } from "./runtimeRegistry";

/**
 * Le runtime ISOLÉ des modules serveur d'extension (capacité
 * `plugins.isolatedRuntime`, contrat `pluginServerRuntime.ts`). Une extension
 * qui déclare `runtime.kind = "isolated"` tourne dans son propre processus ;
 * les autres (Vigie) gardent le chargeur dans le processus,
 * `services/pluginBackendLoader.ts`, qui les ignore désormais.
 */

/**
 * `services` : ce que le runtime emprunte à la musique du cœur (hostServices.ts) —
 * branché AVANT le premier invité (il s'abonne au flux des éléments audio).
 */
export async function registerIsolatedRuntime(app: FastifyInstance, services: Partial<IsolatedRuntimeServices> = {}): Promise<void> {
  configureIsolatedRuntime(services);
  await registerPluginRelay(app, { lookup: relayLookup, serverLocale, mayUse: mayUseIsolatedPlugin });
  const started = await startIsolatedRuntime();
  if (started.length > 0) console.log(`[runtime] invités isolés : ${started.join(", ")}`);
  onJellyfinHealth((next) => {
    pushJellyfinState(next.state === "up" ? "up" : next.state === "down" || next.state === "shutting-down" ? "down" : "restarting");
  });
}

export { stopIsolatedRuntime };
export { isolatedPluginChanged, stopIsolatedPlugin, syncIsolatedPlugins, isIsolatedPlugin, isolatedState } from "./runtimeRegistry";
