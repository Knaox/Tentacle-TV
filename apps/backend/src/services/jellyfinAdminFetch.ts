import { getJellyfinApiKey, getJellyfinUrl } from "./configStore";
import { jellyfinAuthHeaders } from "./jellyfinAuth";

/**
 * Un appel à Jellyfin avec la clé d'administration du serveur, dans la seule
 * forme que toutes les versions acceptent (`jellyfinAuth.ts` : Jellyfin 12
 * refuse `X-Emby-Token` et `api_key`).
 *
 * Le résultat dit POURQUOI un appel échoue — pas de clé, hôte muet, refus,
 * réponse qui n'est pas du JSON — pour que chaque écran l'explique au lieu
 * d'afficher « erreur ».
 */

export type JellyfinFailure = "not-configured" | "unreachable" | "rejected" | "invalid";

export type JellyfinResult<T> =
  | { ok: true; data: T }
  | { ok: false; failure: JellyfinFailure; status?: number };

interface CallOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  /** Un corps envoyé TEL QUEL, avec son type (une image en base64, comme Jellyfin la reçoit). */
  raw?: { contentType: string; data: string };
  timeoutMs?: number;
  /** La réponse n'a pas de corps à lire (204 des écritures de configuration). */
  expectEmpty?: boolean;
}

export async function jellyfinAdminFetch<T = unknown>(path: string, options: CallOptions = {}): Promise<JellyfinResult<T>> {
  const url = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!url || !apiKey) return { ok: false, failure: "not-configured" };
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...jellyfinAuthHeaders(apiKey),
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(options.raw ? { "Content-Type": options.raw.contentType } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      ...(options.raw ? { body: options.raw.data } : {}),
      signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
    });
  } catch {
    return { ok: false, failure: "unreachable" };
  }
  if (!res.ok) return { ok: false, failure: res.status === 401 || res.status === 403 ? "rejected" : "invalid", status: res.status };
  if (options.expectEmpty) return { ok: true, data: null as T };
  try {
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, failure: "invalid", status: res.status };
  }
}
