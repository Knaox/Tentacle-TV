import type { ServerLinksDraft, ServerLinksReport } from "@tentacle-tv/shared";
import { isDesktopApp } from "../../desktop/bridge";
import { getBackendBase } from "../../lib/backendBase";
import { isRecord, readServerLinksReport, str } from "./serverLinksReader";

/**
 * Les appels des liens du serveur — lus par la vue d'ensemble de
 * l'administration et par l'assistant d'installation. L'assistant n'a pas
 * encore de session enregistrée : il passe le jeton que vient de rendre la
 * création de l'administrateur (`token`).
 *
 * L'enregistrement reste celui de la page « Services » (`/public-url`,
 * `/direct-streaming`) : une seule écriture, quel que soit l'écran.
 *
 * Pas de `pages/adminUtils` ici : l'assistant est chargé d'emblée, et ce
 * module-là lit `main.tsx` — importé avant sa fin, il tombait sur un
 * `backendUrl` pas encore initialisé et l'application restait noire.
 */

/** Un refus du serveur ; `404` : un serveur Tentacle d'avant ces routes. */
export class ServerLinksError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    message?: string,
  ) {
    super(message || code || `HTTP ${String(status)}`);
  }
}

export const isOutdatedLinksServer = (error: unknown) => error instanceof ServerLinksError && error.status === 404;

async function call(path: string, { method = "GET", body, token }: { method?: string; body?: object; token?: string } = {}): Promise<unknown> {
  const headers: Record<string, string> = {};
  // Un appel sans corps mais typé JSON, Fastify le refuse : pas de corps, pas d'en-tête.
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const bearer = token ?? localStorage.getItem("tentacle_token");
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  let res: Response;
  try {
    res = await fetch(`${getBackendBase()}/api/admin${path}`, {
      method,
      headers,
      // Le cookie de session sur le web ; le bureau passe le jeton en en-tête.
      credentials: isDesktopApp() ? undefined : "include",
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ServerLinksError(0, "network");
  }
  const raw: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const payload = isRecord(raw) ? raw : {};
    throw new ServerLinksError(res.status, str(payload.error), str(payload.message) ?? undefined);
  }
  return raw;
}

async function report(path: string, options: Parameters<typeof call>[1]): Promise<ServerLinksReport> {
  const value = readServerLinksReport(await call(path, options));
  if (!value) throw new ServerLinksError(200, "unreadable");
  return value;
}

export const serverLinksApi = {
  /** Les liens enregistrés, sondés par le serveur. */
  report: (token?: string) => report("/server-links", { token }),
  /** Un brouillon, sondé avant d'être enregistré. */
  check: (draft: ServerLinksDraft, token?: string) => report("/server-links/check", { method: "POST", body: draft, token }),
  /**
   * Enregistre ce qui est renseigné. La lecture directe ne s'allume qu'avec
   * ses deux adresses ; une seule est gardée pour plus tard, direct éteint.
   */
  save: async (draft: ServerLinksDraft, token?: string) => {
    if (draft.publicUrl) await call("/public-url", { method: "PUT", body: { publicUrl: draft.publicUrl }, token });
    if (draft.jellyfinPublicUrl || draft.jellyfinPrivateUrl) {
      await call("/direct-streaming", {
        method: "PUT",
        body: {
          enabled: Boolean(draft.jellyfinPublicUrl && draft.jellyfinPrivateUrl),
          publicUrl: draft.jellyfinPublicUrl,
          privateUrl: draft.jellyfinPrivateUrl,
        },
        token,
      });
    }
  },
};
