/**
 * Un client HTTP minimal pour PRÉPARER l'instance (assistant de premier
 * démarrage, clé d'API, bibliothèques). Ce n'est pas le code de Tentacle :
 * ce que la suite éprouve passe par l'api-client et le backend.
 *
 * Il n'emploie que les deux formes d'authentification que Jellyfin 12 garde
 * par défaut — l'en-tête `Authorization: MediaBrowser …` et `ApiKey` en
 * query — pour que la préparation marche sur toutes les versions.
 */

export const COMPAT_CLIENT = "Tentacle Compat";
export const COMPAT_DEVICE_ID = "tentacle-jellyfin-compat";

export function mediaBrowserAuth(token?: string, deviceId = COMPAT_DEVICE_ID): string {
  const base = `MediaBrowser Client="${COMPAT_CLIENT}", Device="compat-suite", DeviceId="${deviceId}", Version="1.0.0"`;
  return token ? `${base}, Token="${token}"` : base;
}

export class JellyfinHttpError extends Error {
  constructor(readonly status: number, readonly path: string, body: string) {
    super(`Jellyfin ${status} sur ${path}${body ? ` — ${body.slice(0, 300)}` : ""}`);
  }
}

export interface RequestOptions {
  method?: string;
  token?: string;
  body?: unknown;
  /** Statuts acceptés en plus des 2xx. */
  accept?: number[];
}

export class JellyfinHttp {
  constructor(readonly baseUrl: string) {}

  async request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<{ status: number; data: T }> {
    const headers: Record<string, string> = { Authorization: mediaBrowserAuth(opts.token), Accept: "application/json" };
    let body: string | undefined;
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
    const res = await fetch(`${this.baseUrl}${path}`, { method: opts.method ?? "GET", headers, body });
    const text = await res.text();
    if (!res.ok && !(opts.accept ?? []).includes(res.status)) throw new JellyfinHttpError(res.status, path, text);
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { status: res.status, data: data as T };
  }

  async get<T = unknown>(path: string, token?: string): Promise<T> {
    return (await this.request<T>(path, { token })).data;
  }

  async post<T = unknown>(path: string, body?: unknown, token?: string): Promise<T> {
    return (await this.request<T>(path, { method: "POST", body, token })).data;
  }
}

export const sleep = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms));

/** Attend qu'une condition tienne ; lève avec son libellé à l'échéance. */
export async function waitUntil(
  check: () => Promise<boolean> | boolean,
  timeoutMs: number,
  what: string,
  stepMs = 1000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      if (await check()) return;
    } catch {
      // L'instance redémarre ou n'écoute pas encore : on retente.
    }
    if (Date.now() > deadline) throw new Error(`Délai dépassé (${Math.round(timeoutMs / 1000)} s) : ${what}`);
    await sleep(stepMs);
  }
}
