import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth";
import { getConfigValue } from "../services/configStore";

/**
 * Proxy Tenor v2 — GIFs du chat Watch Together.
 *
 * La clé API reste côté serveur (config DB `tenor_api_key`, éditable depuis
 * l'admin ; repli variable d'env TENOR_API_KEY — même idiome que public_url).
 * Sans clé, l'API répond `{ configured: false }` et le client affiche un état
 * « non configuré » : rien ne casse. Réponses toujours en 200 (hors 400 de
 * validation) pour que le client distingue non-configuré / erreur / vide.
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
  /** Tenor injoignable / en erreur (distinct d'une recherche sans résultat). */
  error?: boolean;
}

const TENOR_BASE = "https://tenor.googleapis.com/v2";
const GIF_LIMIT = 32;
const QUERY_MAX_LENGTH = 100;
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX_ENTRIES = 200;

/** Clé Tenor : config DB (admin) prioritaire, repli env. */
function getTenorKey(): string {
  return getConfigValue("tenor_api_key") || process.env.TENOR_API_KEY || "";
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

interface TenorMediaFormat {
  url?: string;
  dims?: number[];
}
interface TenorResult {
  id?: string;
  media_formats?: Record<string, TenorMediaFormat>;
}

/** Appel amont Tenor (search ou featured) → DTO slim, avec cache. */
async function fetchTenor(kind: "search" | "featured", q: string, locale: string): Promise<GifsResponse> {
  const key = getTenorKey();
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
    const res = await fetch(`${TENOR_BASE}/${kind}?${params.toString()}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { configured: true, results: [], error: true };

    const data = (await res.json()) as { results?: TenorResult[] };
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
    return fetchTenor("featured", "", normalizeLocale(locale));
  });

  /** GET /api/gifs/search?q=&locale= — recherche plein texte Tenor. */
  app.get("/search", async (request, reply) => {
    const { q, locale } = request.query as { q?: string; locale?: string };
    const query = typeof q === "string" ? q.trim() : "";
    if (!query || query.length > QUERY_MAX_LENGTH) {
      return reply.status(400).send({ message: "invalid q" });
    }
    return fetchTenor("search", query, normalizeLocale(locale));
  });
}
