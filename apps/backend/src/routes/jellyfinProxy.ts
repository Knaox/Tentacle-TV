import type { FastifyPluginAsync } from "fastify";
import { Readable } from "stream";
import { fetch as undiciFetch, type RequestInit as UndiciRequestInit } from "undici";
import { getJellyfinUrl, getJellyfinApiKey } from "../services/configStore";
import { verifyDeviceToken, verifyImpersonationToken, hashToken } from "../services/jwt";
import { getPrisma, hasPrisma } from "../services/db";
import { getCached, setCached, getCacheTtl } from "../services/jellyfinCache";
import { getJellyfinDispatcher } from "../services/jellyfinHttpAgent";
import { clearDeviceTokenIfInvalid } from "../services/deviceTokenHealth";
import { isAllowedProxyPath } from "./jellyfinProxy/patterns";
import {
  SKIP_RESPONSE_HEADERS,
  SKIP_API_RESPONSE_HEADERS,
  buildForwardHeaders,
} from "./jellyfinProxy/headers";
import { emitProxyEvents } from "./jellyfinProxy/events";
import { buildPlaystateRewrite, type PlaystateRewrite } from "./jellyfinProxy/playstate";

/** Resolve how to forward a request to Jellyfin :
 *  - Anonymous / native token → no override, pass-through whatever client sent.
 *  - Impersonation JWT (admin "voir en tant que") → admin API key ; les requêtes
 *    user-data ciblent /Users/{userId}/* explicitement, la clé admin suffit.
 *  - Device JWT, route de session :
 *    · si le device a un token Jellyfin stocké → on l'utilise (compte correct) ;
 *    · sinon → clé admin + RÉÉCRITURE du report de lecture vers l'endpoint scopé
 *      userId (/Users/{userId}/PlayingItems/*), car /Sessions/Playing* avec la
 *      clé admin enregistrerait la progression sur le compte admin.
 *  - Device JWT, autre route → admin API key (user-data ciblé par /Users/{id}). */
async function resolveSessionRouting(
  incomingToken: string | undefined,
  wildcardPath: string,
  body: unknown,
): Promise<{ apiKey?: string; rewrite?: PlaystateRewrite; usedDeviceToken?: boolean }> {
  if (!incomingToken) return {};
  const payload = await verifyDeviceToken(incomingToken);
  if (!payload) {
    const impersonation = await verifyImpersonationToken(incomingToken);
    return impersonation ? { apiKey: getJellyfinApiKey() ?? undefined } : {};
  }

  const adminKey = getJellyfinApiKey();
  const isSessionRoute = /^(Sessions\/(Playing|Logout)|Videos\/ActiveEncodings)/.test(wildcardPath);
  if (!isSessionRoute || !hasPrisma()) {
    return { apiKey: adminKey ?? undefined };
  }

  // Routes de session (playstate / logout / active encodings) : on attribue à
  // l'utilisateur via SON token Jellyfin stocké.
  //
  // IMPORTANT (Jellyfin 10.11) : les endpoints legacy `/Users/{userId}/PlayingItems/*`
  // sont `[Obsolete]` et IGNORENT l'userId de l'URL — ils attribuent la lecture
  // au compte du TOKEN porteur. La réécriture clé-admin enregistrait donc la
  // progression sur le compte ADMIN, jamais sur l'utilisateur (état de visionnage
  // jamais mis à jour côté client jumelé). Seul le vrai token Jellyfin du device
  // attribue correctement → on le PRÉFÈRE désormais.
  let deviceToken: string | null = null;
  try {
    const device = await getPrisma().pairedDevice.findUnique({
      where: { tokenHash: hashToken(incomingToken) },
      select: { jellyfinAccessToken: true },
    });
    deviceToken = device?.jellyfinAccessToken ?? null;
  } catch { /* repli ci-dessous */ }

  if (deviceToken) return { apiKey: deviceToken, usedDeviceToken: true };

  // Ce device n'a pas (ou plus) de token Jellyfin propre — typiquement re-jumelé depuis une session
  // web JWT (isJellyfinToken=false au pairing, cf. pair.ts) ou token purgé sur 401. On RÉUTILISE le
  // dernier token Jellyfin VALIDE du MÊME utilisateur (un autre jumelage du même compte) → la
  // progression est attribuée au BON compte au lieu de tomber sur la clé admin. Plusieurs appareils
  // d'un même user partagent alors ce token (OK pour l'état de visionnage ; sessions Jellyfin fusionnées).
  try {
    const sibling = await getPrisma().pairedDevice.findFirst({
      where: { jellyfinUserId: payload.userId, jellyfinAccessToken: { not: null } },
      orderBy: { lastSeen: "desc" },
      select: { jellyfinAccessToken: true },
    });
    if (sibling?.jellyfinAccessToken) return { apiKey: sibling.jellyfinAccessToken, usedDeviceToken: true };
  } catch { /* repli ci-dessous */ }

  // Aucun token Jellyfin pour cet utilisateur : repli best-effort sur la réécriture user-scopée.
  // N'attribue correctement que sur d'anciens Jellyfin (où l'userId d'URL est honoré) ; sinon la
  // télémétrie est perdue (mais aucune attribution erronée bloquante).
  if (adminKey) {
    const rewrite = buildPlaystateRewrite(payload.userId, wildcardPath, body) ?? undefined;
    if (rewrite) return { apiKey: adminKey, rewrite };
  }
  return { apiKey: adminKey ?? undefined };
}

/**
 * Réécrit un manifeste HLS (.m3u8) pour injecter le token du client (`api_key`)
 * dans TOUTES les URLs relatives (sous-playlists `main.m3u8`, segments
 * `hls1/main/N.ts`, et `URI="…"` des renditions audio/sous-titres in-manifest).
 *
 * Indispensable pour Apple TV : AVPlayer (AVURLAsset) ne propage PAS de façon
 * fiable les headers d'auth aux sous-requêtes HLS → la variante/les segments
 * partaient SANS auth → 401 → lecture bloquée à l'infini. Avec l'api_key dans
 * les URLs, AVPlayer le renvoie et le proxy l'honore. Sans effet pour Android
 * (ExoPlayer propage les headers) ni le web (cookie same-origin) : param ignoré.
 */
function rewriteHlsManifest(body: string, token: string): string {
  const hasKey = (u: string) => /[?&](api_key|ApiKey)=/i.test(u);
  const addKey = (u: string) =>
    hasKey(u) ? u : `${u}${u.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(token)}`;
  return body
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith("#")) {
        // URI="…" dans les tags (#EXT-X-MEDIA, #EXT-X-IMAGE-STREAM-INF, I-frames…)
        return line.replace(/URI="([^"]+)"/gi, (_m, u: string) => `URI="${addKey(u)}"`);
      }
      return addKey(line); // ligne d'URL (playlist/segment relatif)
    })
    .join("\n");
}

export const jellyfinProxyRoutes: FastifyPluginAsync = async (app) => {
  app.all("/*", async (request, reply) => {
    const jellyfinUrl = getJellyfinUrl();
    if (!jellyfinUrl) {
      return reply.status(503).send({ message: "Jellyfin not configured" });
    }

    const wildcardPath = (request.params as Record<string, string>)["*"] || "";

    if (!isAllowedProxyPath(wildcardPath)) {
      console.log("[PROXY BLOCKED]", wildcardPath);
      return reply.status(403).send({ error: "Forbidden proxy path" });
    }

    const qs = request.url.includes("?") ? request.url.slice(request.url.indexOf("?")) : "";
    let targetUrl = `${jellyfinUrl}/${wildcardPath}${qs}`;

    // Strip api_key from proxied URLs — auth is handled via X-Emby-Token header.
    // Prevents token leakage in server logs and downstream systems.
    try {
      const u = new URL(targetUrl);
      if (u.searchParams.has("api_key") || u.searchParams.has("ApiKey")) {
        u.searchParams.delete("api_key");
        u.searchParams.delete("ApiKey");
        targetUrl = u.toString();
      }
    } catch { /* leave targetUrl unchanged */ }

    // Jellyfin bug workaround: its playlist generator (DynamicHlsPlaylistGenerator)
    // propagates the full query string — including StartTimeTicks — from the
    // main.m3u8 request into every segment URL.  But its segment handler
    // (GetDynamicSegment) explicitly rejects StartTimeTicks > 0 with a 400.
    // Strip it from HLS segment requests so transcoded playback works.
    if (/\/hls1\//.test(wildcardPath) && !wildcardPath.endsWith(".m3u8")) {
      try {
        const u = new URL(targetUrl);
        u.searchParams.delete("StartTimeTicks");
        u.searchParams.delete("startTimeTicks");
        targetUrl = u.toString();
      } catch { /* leave targetUrl unchanged */ }
    }

    // Web clients send auth via httpOnly cookie — inject as X-Emby-Token header.
    // tvOS : react-native-video (VTT sideload), Image (trickplay) et sendBeacon
    // ne peuvent pas poser de header → ils passent le token en `api_key` query.
    // On l'accepte comme source d'auth (le strip de l'URL forwardée plus haut
    // reste, anti-fuite).
    const cookieToken = (request as { cookies?: { tentacle_token?: string } }).cookies?.tentacle_token;
    const q = request.query as Record<string, string | undefined> | undefined;
    const queryToken = q?.api_key || q?.ApiKey;
    const incomingToken = (request.headers["x-emby-token"] as string | undefined) || cookieToken || queryToken;

    // Mutation d'image utilisateur (upload d'avatar) avec un JWT d'appareil :
    // la clé admin serait substituée en aval — verrouiller la cible sur le
    // compte du token (un token Jellyfin natif est autorisé par Jellyfin même).
    if (request.method !== "GET" && request.method !== "HEAD" && incomingToken) {
      const imgTarget = wildcardPath.match(/^Users\/([^/]+)\/Images\//i);
      if (imgTarget) {
        const devicePayload = await verifyDeviceToken(incomingToken);
        if (devicePayload && devicePayload.userId !== imgTarget[1]) {
          return reply.status(403).send({ error: "Forbidden" });
        }
      }
    }

    const { apiKey: apiKeyOverride, rewrite, usedDeviceToken } = await resolveSessionRouting(incomingToken, wildcardPath, request.body);

    // Report de lecture d'un device sans token Jellyfin : on cible l'endpoint
    // scopé userId (clé admin) pour attribuer la progression au bon compte.
    // L'URL réécrite porte déjà sa query → pas d'append de `qs`, body non envoyé.
    const effectiveMethod = rewrite ? rewrite.method : request.method;
    if (rewrite) targetUrl = `${jellyfinUrl}/${rewrite.path}`;

    // Cache lookup for heavy read routes (Latest/Resume/NextUp/Views).
    // Only applies to GET — mutations always go direct.
    const queryString = qs;
    const cacheTtl = (request.method === "GET" || request.method === "HEAD")
      ? getCacheTtl(wildcardPath) : null;
    if (cacheTtl !== null) {
      const cached = getCached(wildcardPath, queryString, incomingToken);
      if (cached) {
        reply.status(cached.status);
        reply.header("content-type", cached.contentType);
        reply.header("x-tentacle-cache", "HIT");
        return reply.send(cached.body);
      }
    }

    const headers = buildForwardHeaders(request.headers as Record<string, string | string[] | undefined>, apiKeyOverride);

    // Cookie-based auth: inject token as X-Emby-Token if not already present from headers.
    // Use apiKeyOverride (admin API key) when the cookie was a verified device JWT,
    // otherwise forward the raw cookie (Jellyfin native token).
    if (cookieToken && !headers["x-emby-token"] && !headers["X-Emby-Token"]) {
      headers["X-Emby-Token"] = apiKeyOverride ?? cookieToken;
    }

    // Progressive video streams (remux) can last hours — use a long timeout.
    // HLS segments and API calls complete quickly, keep short timeout.
    const isProgressiveStream = /Videos\/.*\/stream/.test(wildcardPath);
    const timeout = isProgressiveStream ? 4 * 60 * 60 * 1000 : 120_000;

    const fetchInit: UndiciRequestInit = {
      method: effectiveMethod,
      headers,
      signal: AbortSignal.timeout(timeout),
      // Reuse the keep-alive pool to avoid a TCP+TLS handshake on every
      // HLS segment / API call (~30-50 ms saved per request).
      dispatcher: getJellyfinDispatcher(),
    };

    // Forward body for POST/PUT/PATCH/DELETE — sauf report réécrit (params en query).
    if (!rewrite && request.method !== "GET" && request.method !== "HEAD") {
      const rawBody = request.body;
      if (rawBody !== undefined && rawBody !== null) {
        if (typeof rawBody === "string" || Buffer.isBuffer(rawBody)) {
          fetchInit.body = rawBody as string | Buffer;
        } else {
          fetchInit.body = JSON.stringify(rawBody);
        }
      }
    }

    try {
      const response = await undiciFetch(targetUrl, fetchInit);
      reply.status(response.status);

      // Auto-réparation : un report de session avec le token Jellyfin du device
      // qui prend un 401/403 ⇒ token probablement périmé. On le valide (/Users/Me)
      // et on le PURGE s'il est réellement invalide (cf. clearDeviceTokenIfInvalid),
      // sinon le proxy le réutiliserait en boucle → spam de 401. Fire-and-forget.
      if (usedDeviceToken && incomingToken && (response.status === 401 || response.status === 403)) {
        void clearDeviceTokenIfInvalid(incomingToken);
      }

      // Media streams: forward content-length/encoding so the browser can
      // support Range requests, progress bars, and correct buffering.
      const isMediaResponse = isProgressiveStream || /\/(hls1|Audio)\//.test(wildcardPath);
      for (const [key, value] of response.headers) {
        const lower = key.toLowerCase();
        if (SKIP_RESPONSE_HEADERS.has(lower)) continue;
        if (!isMediaResponse && SKIP_API_RESPONSE_HEADERS.has(lower)) continue;
        reply.header(key, value);
      }

      // Log Jellyfin error responses for debugging — without buffering the
      // whole body, which would force the entire (potentially multi-MB) error
      // payload into RAM and add 200-500 ms of latency on every 4xx/5xx.
      if (response.status >= 400) {
        request.log.warn(
          { status: response.status, path: wildcardPath, method: request.method },
          "Jellyfin error",
        );
      }

      // Emit WS events on successful mutations
      if (response.status < 400 && request.method !== "GET" && request.method !== "HEAD") {
        emitProxyEvents(wildcardPath, request);
      }

      // 204 No Content: must not include a body per HTTP spec.
      if (response.status === 204 || !response.body) {
        return reply.send();
      }

      // Cacheable routes (Latest/Resume/NextUp/Views): buffer once in RAM so
      // future hits can reply from cache. Media/error routes: stream as-is.
      if (cacheTtl !== null && !isMediaResponse && response.status < 400) {
        const arrayBuf = await response.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        const contentType = response.headers.get("content-type") ?? "application/json";
        setCached(wildcardPath, queryString, incomingToken, buf, contentType, response.status, cacheTtl);
        reply.header("x-tentacle-cache", "MISS");
        return reply.send(buf);
      }

      // Manifeste HLS (.m3u8) : bufferiser (petit) et injecter l'api_key du
      // client dans les sous-URLs → débloque le transcode sur Apple TV (AVPlayer
      // n'auth pas les sous-requêtes HLS par header). cf. rewriteHlsManifest.
      const ct = response.headers.get("content-type") ?? "";
      const isM3u8 = wildcardPath.endsWith(".m3u8") || /mpegurl/i.test(ct);
      if (isM3u8 && incomingToken && response.status < 400) {
        const text = await response.text();
        const rewritten = rewriteHlsManifest(text, incomingToken);
        reply.removeHeader("content-encoding");
        reply.removeHeader("content-length");
        reply.header("content-length", Buffer.byteLength(rewritten));
        return reply.send(rewritten);
      }

      const nodeStream = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
      return reply.send(nodeStream);
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        return reply.status(504).send({ message: "Jellyfin timeout" });
      }
      const msg = err instanceof Error ? err.message : "Proxy error";
      request.log.error({ path: wildcardPath, method: request.method, error: msg }, "Proxy error");
      return reply.status(502).send({ message: msg });
    }
  });
};
