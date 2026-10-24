import {
  HOST_METHODS,
  hostMethodFamily,
  type GuestToHost,
  type HostApi,
  type HostCallError,
  type HostMethod,
  type HostToGuest,
  type PluginRuntimeManifest,
} from "./pluginServerRuntime";
import { HOST_PARAM_SCHEMAS } from "./hostSchemas";

/**
 * La porte de l'API d'hôte : un appel de l'invité ne passe que s'il nomme une
 * méthode de la liste FERMÉE (`HOST_METHODS`), d'une famille que son manifeste
 * DÉCLARE (`hostApi`), avec des paramètres valides (`hostSchemas.ts`). Sinon :
 * `forbidden` ou `invalid`, sans jamais toucher à rien. Une exception d'un
 * gestionnaire devient `failed` — son message n'emporte rien de l'intérieur
 * (ni chemin, ni clé, ni réponse de Jellyfin).
 */

/** Ce qu'un gestionnaire sait de l'appelant : l'extension, jamais un compte. */
export interface HostCallContext {
  pluginId: string;
  manifest: PluginRuntimeManifest;
  pluginDir: string;
  dataDir: string;
}

export class HostCallFailure extends Error {
  constructor(readonly code: HostCallError["code"], message: string) {
    super(message);
  }
}

export type HostHandlers = {
  [M in HostMethod]: (ctx: HostCallContext, params: HostApi[M]["params"]) => Promise<HostApi[M]["result"]>;
};

const ERROR_CODES: readonly HostCallError["code"][] = ["forbidden", "invalid", "unavailable", "notFound", "timeout", "failed"];

function hostErrorOf(err: unknown): HostCallError | null {
  if (!(err instanceof Error)) return null;
  const code = (err as Error & { code?: unknown }).code;
  return typeof code === "string" && (ERROR_CODES as readonly string[]).includes(code)
    ? { code: code as HostCallError["code"], message: err.message.slice(0, 300) }
    : null;
}

/** Au plus tant d'appels EN COURS par invité : au-delà, `unavailable` (l'invité réessaie). */
const MAX_IN_FLIGHT = 64;

function isHostMethod(value: unknown): value is HostMethod {
  return typeof value === "string" && (HOST_METHODS as readonly string[]).includes(value);
}

export function createHostDispatcher(ctx: HostCallContext, handlers: HostHandlers) {
  let inFlight = 0;
  const fail = (id: number, code: HostCallError["code"], message: string): HostToGuest => ({
    t: "result",
    id,
    ok: false,
    error: { code, message },
  });

  async function run(msg: Extract<GuestToHost, { t: "call" }>): Promise<HostToGuest> {
    const { id, method } = msg;
    if (!isHostMethod(method)) return fail(id, "forbidden", "méthode inconnue");
    if (!(ctx.manifest.hostApi ?? []).includes(hostMethodFamily(method))) {
      return fail(id, "forbidden", `famille non déclarée : ${hostMethodFamily(method)}`);
    }
    const parsed = HOST_PARAM_SCHEMAS[method].safeParse(msg.params ?? {});
    if (!parsed.success) return fail(id, "invalid", `paramètres invalides pour ${method}`);
    try {
      const handler = handlers[method] as (c: HostCallContext, p: unknown) => Promise<unknown>;
      const value = await handler(ctx, parsed.data);
      return { t: "result", id, ok: true, value };
    } catch (err) {
      if (err instanceof HostCallFailure) return fail(id, err.code, err.message);
      // Un refus d'un service du cœur (`HostMusicFailure`…) porte un code du contrat : il passe tel quel.
      const known = hostErrorOf(err);
      if (known) return fail(id, known.code, known.message);
      console.warn(`[plugin:${ctx.pluginId}] ${method} :`, err instanceof Error ? err.message : err);
      return fail(id, "failed", `${method} a échoué`);
    }
  }

  return (msg: Extract<GuestToHost, { t: "call" }>, reply: (out: HostToGuest) => void): void => {
    if (inFlight >= MAX_IN_FLIGHT) {
      reply(fail(msg.id, "unavailable", "trop d'appels en cours"));
      return;
    }
    inFlight++;
    void run(msg)
      .then(reply)
      .finally(() => {
        inFlight--;
      });
  };
}
