/**
 * Les gestes que l'hôte SERT au serveur (`HOST_METHODS`) : la question arrive
 * par le canal IPC (`tentacle:request`), la réponse repart au même `id`.
 * Une méthode que l'hôte ne connaît pas répond `unknown_method` ; une erreur
 * imprévue, `failed` — jamais un plantage de l'hôte.
 *
 * Chaque geste est déjà gardé côté serveur (assistant ouvert, session, parcours,
 * machine locale pour la boîte de dialogue) : ici, on exécute.
 */
import type {
  HostMethod, HostProtocolError, JellyfinInstallStatus, JellyfinLocalDetection, JellyfinStartResult, PickFolderParams, PickFolderResult,
} from "../protocol";
import { parsePickFolderParams } from "../protocol";

export type HostServeResult = { ok: true; result: unknown } | { ok: false; error: HostProtocolError };

export interface HostServices {
  readonly methods: readonly HostMethod[];
  handle(method: string, params: unknown): Promise<HostServeResult>;
}

export interface HostServiceDeps {
  detect: () => Promise<JellyfinLocalDetection>;
  install: () => JellyfinInstallStatus;
  installStatus: () => JellyfinInstallStatus;
  start: () => Promise<JellyfinStartResult>;
  pickFolder: (params: PickFolderParams) => Promise<PickFolderResult>;
  log: (line: string) => void;
}

export function createHostServices(deps: HostServiceDeps): HostServices {
  const handlers: Record<HostMethod, (params: unknown) => Promise<unknown>> = {
    "jellyfin.detect": () => deps.detect(),
    "jellyfin.install": async () => deps.install(),
    "jellyfin.installStatus": async () => deps.installStatus(),
    "jellyfin.start": () => deps.start(),
    "dialog.pickFolder": (params) => deps.pickFolder(parsePickFolderParams(params)),
  };
  const methods = Object.keys(handlers) as HostMethod[];
  return {
    methods,
    async handle(method, params) {
      const handler = (methods as readonly string[]).includes(method) ? handlers[method as HostMethod] : null;
      if (!handler) return { ok: false, error: "unknown_method" };
      try {
        return { ok: true, result: await handler(params) };
      } catch (error) {
        deps.log(`geste ${method} en échec : ${error instanceof Error ? error.message : String(error)}`);
        return { ok: false, error: "failed" };
      }
    },
  };
}
