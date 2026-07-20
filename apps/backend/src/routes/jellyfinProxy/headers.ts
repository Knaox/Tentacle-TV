/** Headers to skip when proxying (hop-by-hop). */
export const SKIP_REQUEST_HEADERS = new Set([
  "host", "connection", "keep-alive", "transfer-encoding",
  "te", "trailer", "upgrade", "proxy-authorization", "proxy-authenticate",
  // Fastify parses then re-serializes JSON bodies — Content-Length may change.
  // Let Node.js fetch recalculate it from the actual body.
  "content-length",
]);

export const SKIP_RESPONSE_HEADERS = new Set([
  "transfer-encoding", "connection", "keep-alive",
]);

/** Extra headers to strip for non-media (API/JSON) responses.
 *  Node fetch auto-decompresses gzipped JSON — content-length/encoding change.
 *  Media streams pass through raw bytes, so these headers stay accurate. */
export const SKIP_API_RESPONSE_HEADERS = new Set([
  "content-encoding", "content-length",
]);

/** Affiches, backdrops, logos, vignettes — `patterns.ts` autorise déjà ce motif. */
const IMAGE_PATH = /^Items\/[^/]+\/Images\//i;

/**
 * `Cache-Control` pour les images du proxy.
 *
 * Rien n'était émis jusqu'ici : les affiches et backdrops redescendaient du
 * serveur à CHAQUE lancement de l'app, alors que les tuiles de trickplay, elles,
 * sont cachées un an (`jellyfinTrickplay.ts`). Sur une connexion lente c'est le
 * premier poste de consommation évitable — les images pèsent ~75 % du fil d'un
 * premier écran et sont incompressibles.
 *
 * - `private` : le proxy est authentifié, un cache partagé ne doit pas stocker.
 * - `max-age=86400` : une journée ferme. Pas d'`immutable` ni de durée d'un an —
 *   aucun appelant ne passe le `tag` Jellyfin (cf. `urlBuilder.ts`), donc les
 *   URLs ne sont PAS adressées par contenu : une affiche modifiée doit finir
 *   par ressortir.
 * - `stale-while-revalidate` : une semaine d'affichage immédiat pendant que la
 *   revalidation se fait en arrière-plan — exactement le comportement voulu au
 *   lancement sur un lien lent.
 */
export function imageCacheControl(path: string): string | null {
  return IMAGE_PATH.test(path) ? "private, max-age=86400, stale-while-revalidate=604800" : null;
}

/** Build the headers to forward to Jellyfin, swapping the X-Emby auth fields
 *  to use the admin API key when the incoming request carries a verified
 *  device JWT. */
export function buildForwardHeaders(
  incoming: Record<string, string | string[] | undefined>,
  apiKeyOverride: string | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (typeof value !== "string") continue;
    if (SKIP_REQUEST_HEADERS.has(key.toLowerCase())) continue;
    const lower = key.toLowerCase();
    if (apiKeyOverride) {
      if (lower === "x-emby-token") {
        headers[key] = apiKeyOverride;
        continue;
      }
      if (lower === "x-emby-authorization") {
        headers[key] = value.replace(/Token="[^"]*"/, `Token="${apiKeyOverride}"`);
        continue;
      }
    }
    headers[key] = value;
  }
  return headers;
}
