/**
 * Octave — le titre et l'artiste d'un lien SHAZAM, lus par le serveur (capacité `music.sharedLinks`).
 *
 * Jamais l'adresse reçue telle quelle : le serveur REBÂTIT l'adresse à interroger à partir de l'identifiant
 * reconnu, sur deux catalogues JSON fixes — `/song/<id>` (identifiant Apple Music) → la recherche iTunes,
 * `/track/<clé>` (clé Shazam) → le catalogue de Shazam. La page web de Shazam ne dit rien d'utile (son `og:title`
 * est celui d'un titre en vogue, quel que soit le lien : mesuré le 29/10). Un lien court (`shz.am`) se suit à la
 * main, une redirection à la fois, et chaque étape repasse par la même reconnaissance.
 */

import { recognizeShazamUrl, trackQueryOf, type ShazamLink, type SharedTrackQuery, type SharedTrackRefusal } from "../contract/shazamLink";

export type ShazamFetch = (url: string, init: { headers: Record<string, string>; redirect: "manual"; signal: AbortSignal }) => Promise<Response>;

const BODY_MAX = 512 * 1024;
const TIMEOUT_MS = 5_000;
const MAX_HOPS = 3;
const HEADERS = { "accept-language": "en-US,en;q=0.8", accept: "application/json", "user-agent": "Mozilla/5.0 (compatible; TentacleTV)" };

const CACHE_MAX = 500;
const CACHE_TTL_MS = 24 * 3600_000;
const cache = new Map<string, { at: number; value: SharedTrackQuery }>();

function remember(key: string, value: SharedTrackQuery): SharedTrackQuery {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value });
  return value;
}

type TrackLink = Extract<ShazamLink, { kind: "track" }>;

/** L'adresse du catalogue d'un titre, rebâtie : jamais un morceau de l'adresse reçue d'autre que l'identifiant. */
function catalogUrl(link: TrackLink): string {
  return link.catalog === "apple"
    ? `https://itunes.apple.com/lookup?id=${link.trackId}&entity=song`
    : `https://cdn.shazam.com/discovery/v5/en-US/US/web/-/track/${link.trackId}`;
}

/** Le titre et l'artiste d'une réponse du catalogue ; `null` si la forme n'y est pas. */
export function catalogTrackOf(catalog: TrackLink["catalog"], body: unknown): SharedTrackQuery | null {
  if (!body || typeof body !== "object") return null;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  if (catalog === "apple") {
    const results = (body as { results?: unknown }).results;
    const song = Array.isArray(results) ? results.find((r) => r && typeof r === "object" && (r as { kind?: unknown }).kind === "song") : null;
    const title = song ? str((song as { trackName?: unknown }).trackName) : null;
    return title ? trackQueryOf(title, str((song as { artistName?: unknown }).artistName)) : null;
  }
  const title = str((body as { title?: unknown }).title);
  return title ? trackQueryOf(title, str((body as { subtitle?: unknown }).subtitle)) : null;
}

async function readJson(response: Response): Promise<unknown> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > BODY_MAX) throw new Error("trop gros");
  const text = await response.text();
  if (text.length > BODY_MAX) throw new Error("trop gros");
  return JSON.parse(text);
}

export async function resolveShazamLink(input: string, fetcher: ShazamFetch = fetch as ShazamFetch): Promise<SharedTrackQuery | { refusal: SharedTrackRefusal }> {
  let link = recognizeShazamUrl(input);
  if (!link) return { refusal: "unsupported" };
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    for (let hop = 0; link.kind === "short"; hop++) {
      if (hop >= MAX_HOPS) return { refusal: "not_found" };
      const response = await fetcher(`https://shz.am/${encodeURIComponent(link.code)}`, { headers: HEADERS, redirect: "manual", signal });
      await response.body?.cancel().catch(() => undefined);
      const location = response.headers.get("location");
      const next = location ? recognizeShazamUrl(new URL(location, "https://shz.am/").toString()) : null;
      if (!next) return { refusal: "not_found" };
      link = next;
    }
    const key = `${link.catalog}:${link.trackId}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
    const response = await fetcher(catalogUrl(link), { headers: HEADERS, redirect: "manual", signal });
    if (response.status === 404) return { refusal: "not_found" };
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return { refusal: "unavailable" };
    }
    const found = catalogTrackOf(link.catalog, await readJson(response));
    return found ? remember(key, found) : { refusal: "not_found" };
  } catch {
    return { refusal: "unavailable" };
  }
}

/** Pour les tests : oublier ce qui a été lu. */
export function resetShazamCache(): void {
  cache.clear();
}
