import { getConfigValue } from "../configStore";

const TMDB_BASE = "https://api.themoviedb.org/3";

// TMDB tolère mal les rafales : un espaceur global d'environ 4 requêtes par
// seconde, partagé par tout le backend. Les appels s'enchaînent sur une
// promesse-file — pas de timer par requête, pas de perte d'ordre.
const MIN_INTERVAL_MS = 250;
const RETRY_MAX = 3;

let lastSlot = Promise.resolve();
let lastCallAt = 0;

// Dédoublonnage des GET identiques en vol : deux fiches ouvertes sur le même
// titre ne coûtent qu'un appel.
const inFlight = new Map<string, Promise<unknown>>();

export class TmdbError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "TmdbError";
    this.status = status;
  }
}

/**
 * La clé TMDB de CE serveur : variable d'environnement prioritaire, sinon la
 * clé saisie par l'admin (server_config.tmdb_api_key). Chaque instance
 * Tentacle a la sienne — aucune clé n'est embarquée dans le code.
 */
export function getTmdbApiKey(): string | undefined {
  return process.env.TMDB_API_KEY || getConfigValue("tmdb_api_key") || undefined;
}

export function tmdbConfigured(): boolean {
  return !!getTmdbApiKey();
}

function nextSlot(): Promise<void> {
  const slot = lastSlot.then(async () => {
    const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
  });
  // La file ne doit jamais se briser : une erreur d'appel ne concerne pas le
  // suivant, seul le cadencement est partagé.
  lastSlot = slot.catch(() => undefined);
  return slot;
}

async function rawFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const apiKey = getTmdbApiKey();
  if (!apiKey) throw new TmdbError("TMDB non configuré", 0);

  // La clé passe en QUERY PARAM, jamais en Bearer : avec un Bearer, TMDB
  // attache les écritures (notes) au compte propriétaire de la clé au lieu de
  // la guest session. Piège documenté — ne pas « moderniser » cet appel.
  const q = new URLSearchParams({ ...params, api_key: apiKey });
  const url = `${TMDB_BASE}${path}?${q.toString()}`;

  for (let attempt = 0; ; attempt++) {
    await nextSlot();
    const res = await fetch(url);
    if (res.status === 429 && attempt < RETRY_MAX) {
      const retryAfter = Number(res.headers.get("retry-after")) || 1;
      await new Promise((r) => setTimeout(r, retryAfter * 1000 + 100));
      continue;
    }
    if (!res.ok) {
      throw new TmdbError(`TMDB ${res.status} sur ${path}`, res.status);
    }
    return (await res.json()) as T;
  }
}

/** GET TMDB v3, cadencé et dédoublonné. `method` autre que GET : pas de dédup. */
export async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = `${path}?${new URLSearchParams(params).toString()}`;
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;
  const p = rawFetch<T>(path, params).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

/** POST/DELETE TMDB v3 (notation guest session) — cadencé, jamais dédoublonné. */
export async function tmdbWrite<T>(
  method: "POST" | "DELETE",
  path: string,
  params: Record<string, string>,
  body?: unknown
): Promise<T> {
  const apiKey = getTmdbApiKey();
  if (!apiKey) throw new TmdbError("TMDB non configuré", 0);
  const q = new URLSearchParams({ ...params, api_key: apiKey });
  await nextSlot();
  const res = await fetch(`${TMDB_BASE}${path}?${q.toString()}`, {
    method,
    headers: body ? { "Content-Type": "application/json;charset=utf-8" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new TmdbError(`TMDB ${res.status} sur ${path}`, res.status);
  return (await res.json()) as T;
}
