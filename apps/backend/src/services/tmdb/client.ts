import { getConfigValue } from "../configStore";

const TMDB_BASE = "https://api.themoviedb.org/3";

// TMDB tolère mal les rafales : un espaceur global d'environ 4 requêtes par
// seconde, partagé par tout le backend. Surchargeable par l'environnement pour
// MESURER une cadence plus haute sans commit (TMDB_MIN_INTERVAL_MS=120) — le
// retry sur 429 reste le filet.
const MIN_INTERVAL_MS = Number(process.env.TMDB_MIN_INTERVAL_MS) || 250;
const RETRY_MAX = 3;

/**
 * Deux files, un seul cadencement. L'INTERACTIVE (fiches, recherche de
 * personnes, notation) passe toujours devant le FOND (génération de pool,
 * crawler de plateformes) : avant, la recherche d'un acteur attendait jusqu'à
 * 35 s derrière les ~138 appels d'une génération, dans une file unique.
 */
export type TmdbPriority = "interactive" | "background";

export interface TmdbFetchOptions {
  /** Défaut : interactive — ce qu'un utilisateur attend à l'écran. */
  priority?: TmdbPriority;
}

const lanes: Record<TmdbPriority, Array<() => void>> = { interactive: [], background: [] };
let lastCallAt = 0;
let lastInteractiveAt = 0;
let pumpTimer: NodeJS.Timeout | null = null;

// Dédoublonnage des GET identiques en vol : deux fiches ouvertes sur le même
// titre ne coûtent qu'un appel. La clé ignore la priorité — un appel de fond
// en vol sert aussi l'interactif qui arrive.
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

/** Horodatage du dernier créneau INTERACTIF — le crawler s'efface 2 s après. */
export function tmdbLastInteractiveAt(): number {
  return lastInteractiveAt;
}

/** Vide les files et remet les horloges : isolation des tests, rien d'autre. */
export function resetTmdbClientForTests(): void {
  lanes.interactive.length = 0;
  lanes.background.length = 0;
  lastCallAt = 0;
  lastInteractiveAt = 0;
  if (pumpTimer) clearTimeout(pumpTimer);
  pumpTimer = null;
  inFlight.clear();
}

/** Accorde UN créneau : interactive d'abord, puis le fond ; espacés de
 *  MIN_INTERVAL_MS. Un seul réveil programmé à la fois — la file ne se brise
 *  jamais, une erreur d'appel ne concerne pas le suivant. */
function pump(): void {
  if (pumpTimer) return;
  const lane: TmdbPriority | null = lanes.interactive.length
    ? "interactive"
    : lanes.background.length
      ? "background"
      : null;
  if (!lane) return;
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) {
    pumpTimer = setTimeout(() => {
      pumpTimer = null;
      pump();
    }, wait);
    return;
  }
  const release = lanes[lane].shift();
  lastCallAt = Date.now();
  if (lane === "interactive") lastInteractiveAt = lastCallAt;
  release?.();
  // Le suivant attend son propre créneau : réarme tout de suite.
  pump();
}

function acquireSlot(priority: TmdbPriority): Promise<void> {
  return new Promise<void>((resolve) => {
    lanes[priority].push(resolve);
    pump();
  });
}

async function rawFetch<T>(
  path: string,
  params: Record<string, string>,
  priority: TmdbPriority
): Promise<T> {
  const apiKey = getTmdbApiKey();
  if (!apiKey) throw new TmdbError("TMDB non configuré", 0);

  // La clé passe en QUERY PARAM, jamais en Bearer : avec un Bearer, TMDB
  // attache les écritures (notes) au compte propriétaire de la clé au lieu de
  // la guest session. Piège documenté — ne pas « moderniser » cet appel.
  const q = new URLSearchParams({ ...params, api_key: apiKey });
  const url = `${TMDB_BASE}${path}?${q.toString()}`;

  for (let attempt = 0; ; attempt++) {
    await acquireSlot(priority);
    const res = await fetch(url);
    if (res.status === 429 && attempt < RETRY_MAX) {
      const retryAfter = Number(res.headers.get("retry-after")) || 1;
      await new Promise((r) => setTimeout(r, retryAfter * 1000 + 100));
      // Reprise d'un créneau dans la MÊME file : l'interactif arrivé entre-temps
      // passe devant une relance de fond.
      continue;
    }
    if (!res.ok) {
      throw new TmdbError(`TMDB ${res.status} sur ${path}`, res.status);
    }
    return (await res.json()) as T;
  }
}

/** GET TMDB v3, cadencé, dédoublonné et priorisé. */
export async function tmdbFetch<T>(
  path: string,
  params: Record<string, string> = {},
  opts: TmdbFetchOptions = {}
): Promise<T> {
  const key = `${path}?${new URLSearchParams(params).toString()}`;
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;
  const p = rawFetch<T>(path, params, opts.priority ?? "interactive").finally(() =>
    inFlight.delete(key)
  );
  inFlight.set(key, p);
  return p;
}

/** POST/DELETE TMDB v3 (notation guest session) — cadencé, jamais dédoublonné. */
export async function tmdbWrite<T>(
  method: "POST" | "DELETE",
  path: string,
  params: Record<string, string>,
  body?: unknown,
  opts: TmdbFetchOptions = {}
): Promise<T> {
  const apiKey = getTmdbApiKey();
  if (!apiKey) throw new TmdbError("TMDB non configuré", 0);
  const q = new URLSearchParams({ ...params, api_key: apiKey });
  await acquireSlot(opts.priority ?? "interactive");
  const res = await fetch(`${TMDB_BASE}${path}?${q.toString()}`, {
    method,
    headers: body ? { "Content-Type": "application/json;charset=utf-8" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new TmdbError(`TMDB ${res.status} sur ${path}`, res.status);
  return (await res.json()) as T;
}
