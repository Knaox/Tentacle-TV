import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth";
import { BAKED_KLIPY_KEY } from "../generated/klipyKey";

/**
 * Proxy Klipy — GIFs du chat Watch Together (mode compat Tenor : l'API Tenor
 * a fermé le 30/06/2026 et Klipy en est le remplacement officiel drop-in —
 * mêmes chemins /v2, mêmes paramètres, même format de réponse).
 *
 * Clé UNIQUE au niveau application, COMPILÉE dans le build par la CI
 * (generated/klipyKey.ts, gravée avant tsc par scripts/bake-klipy-key.mjs) :
 * ni env d'image, ni docker-compose — non modifiable par l'opérateur d'un
 * serveur. Le repli process.env.KLIPY_API_KEY ne sert qu'au dev local (et il
 * est ignoré dès qu'une clé compilée existe). Sans clé, l'API répond
 * `{ configured: false }` et le client affiche un état « non disponible » :
 * rien ne casse. Réponses toujours en 200 (hors 400 de validation) pour que
 * le client distingue non-configuré / erreur / vide.
 */

export interface GifDto {
  id: string;
  /** URL `tinygif` (~220 px) : sert d'aperçu ET d'URL broadcastée en wt:gif. */
  url: string;
  w: number;
  h: number;
}

export interface GifsResponse {
  configured: boolean;
  results: GifDto[];
  /** Klipy injoignable / en erreur (distinct d'une recherche sans résultat). */
  error?: boolean;
}

const KLIPY_BASE = "https://api.klipy.com/v2";
const GIF_LIMIT = 32;
const QUERY_MAX_LENGTH = 100;
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX_ENTRIES = 200;

/** Clé Klipy : la clé compilée (CI) prime et rend l'env inopérant ;
 *  l'env n'est qu'un repli de dev local. */
function getKlipyKey(): string {
  return BAKED_KLIPY_KEY || process.env.KLIPY_API_KEY || "";
}

const LOCALE_RE = /^[a-z]{2}(_[A-Z]{2})?$/;

/** Normalise la locale client (`fr`, `fr_FR`…) vers le format Tenor xx_YY. */
function normalizeLocale(raw: unknown): string {
  if (typeof raw !== "string" || !LOCALE_RE.test(raw.trim())) return "en_US";
  const v = raw.trim();
  if (v.includes("_")) return v;
  return v === "en" ? "en_US" : `${v}_${v.toUpperCase()}`;
}

/** Cache mémoire borné (TTL 5 min, éviction FIFO) — même approche que tmdb.ts.
 *  Les réponses en erreur ne sont jamais mises en cache. */
const cache = new Map<string, { at: number; data: GifsResponse }>();

function cacheGet(key: string): GifsResponse | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

function cacheSet(key: string, data: GifsResponse): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), data });
}

interface KlipyMediaFormat {
  url?: string;
  dims?: number[];
}
interface KlipyResult {
  id?: string;
  media_formats?: Record<string, KlipyMediaFormat>;
}

/** Appel amont Klipy (search ou featured) → DTO slim, avec cache. */
async function fetchKlipy(kind: "search" | "featured", q: string, locale: string): Promise<GifsResponse> {
  const key = getKlipyKey();
  if (!key) return { configured: false, results: [] };

  const cacheKey = `${kind}:${locale}:${q}`;
  const hit = cacheGet(cacheKey);
  if (hit) return hit;

  const params = new URLSearchParams({
    key,
    client_key: "tentacle_tv",
    limit: String(GIF_LIMIT),
    media_filter: "tinygif",
    contentfilter: "low",
    locale,
  });
  if (kind === "search") params.set("q", q);

  try {
    const res = await fetch(`${KLIPY_BASE}/${kind}?${params.toString()}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { configured: true, results: [], error: true };

    const data = (await res.json()) as { results?: KlipyResult[] };
    const results: GifDto[] = [];
    for (const r of data.results ?? []) {
      const tiny = r.media_formats?.tinygif;
      if (!r.id || !tiny?.url) continue;
      results.push({
        id: r.id,
        url: tiny.url,
        w: tiny.dims?.[0] ?? 0,
        h: tiny.dims?.[1] ?? 0,
      });
    }
    const payload: GifsResponse = { configured: true, results };
    cacheSet(cacheKey, payload);
    return payload;
  } catch {
    return { configured: true, results: [], error: true };
  }
}

export async function gifRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  /** GET /api/gifs/featured?locale= — tendances (grille remplie sans recherche). */
  app.get("/featured", async (request) => {
    const { locale } = request.query as { locale?: string };
    return fetchKlipy("featured", "", normalizeLocale(locale));
  });

  /** GET /api/gifs/search?q=&locale= — recherche plein texte Klipy. */
  app.get("/search", async (request, reply) => {
    const { q, locale } = request.query as { q?: string; locale?: string };
    const query = typeof q === "string" ? q.trim() : "";
    if (!query || query.length > QUERY_MAX_LENGTH) {
      return reply.status(400).send({ message: "invalid q" });
    }
    return fetchKlipy("search", query, normalizeLocale(locale));
  });
}
