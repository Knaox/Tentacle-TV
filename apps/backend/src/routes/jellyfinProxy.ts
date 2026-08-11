import type { FastifyPluginAsync } from "fastify";
import { Readable } from "stream";
import { fetch as undiciFetch, type RequestInit as UndiciRequestInit } from "undici";
import { getJellyfinUrl, getJellyfinApiKey } from "../services/configStore";
import { verifyDeviceToken } from "../services/jwt";
import { getCached, setCached, getCacheTtl } from "../services/jellyfinCache";
import { getJellyfinDispatcher } from "../services/jellyfinHttpAgent";
import { clearDeviceTokenIfInvalid } from "../services/deviceTokenHealth";
import { isAllowedProxyPath } from "./jellyfinProxy/patterns";
import {
  SKIP_RESPONSE_HEADERS,
  SKIP_API_RESPONSE_HEADERS,
  buildForwardHeaders,
  imageCacheControl,
} from "./jellyfinProxy/headers";
import { emitProxyEvents } from "./jellyfinProxy/events";
import { porteUneUrlDeLecture, scrubAdminKey } from "./jellyfinProxy/scrubAdminKey";
import { rewriteHlsManifest } from "./jellyfinProxy/rewriteHlsManifest";
import { horsDuPerimetre, userIdDuChemin } from "./jellyfinProxy/userScope";
import { resolveSessionRouting } from "./jellyfinProxy/routageSession";
import { urlCible } from "./jellyfinProxy/urlCible";
import { tracerCorps, tracerEchec, tracerEntetes } from "./jellyfinProxy/tracesFlux";
import { signalDeRequete } from "./jellyfinProxy/annulationClient";

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
    let targetUrl = urlCible(jellyfinUrl, wildcardPath, qs);

    // Web clients send auth via httpOnly cookie — inject as X-Emby-Token header.
    // tvOS : react-native-video (VTT sideload), Image (trickplay) et sendBeacon
    // ne peuvent pas poser de header → ils passent le token en `api_key` query.
    // On l'accepte comme source d'auth (le strip de l'URL forwardée plus haut
    // reste, anti-fuite).
    const cookieToken = (request as { cookies?: { tentacle_token?: string } }).cookies?.tentacle_token;
    const q = request.query as Record<string, string | undefined> | undefined;
    const queryToken = q?.api_key || q?.ApiKey;
    const incomingToken = (request.headers["x-emby-token"] as string | undefined) || cookieToken || queryToken;

    // Un appareil jumelé ne parle que pour SON compte.
    //
    // La clé admin est substituée en aval pour un JWT d'appareil : sans ce
    // garde, changer l'identifiant dans l'URL donnait accès aux données d'un
    // autre compte, avec les pleins pouvoirs derrière. La liste blanche
    // autorise `Users/{id}/Items`, `/Views`, `/FavoriteItems/…`,
    // `/PlayedItems/…` — donc la lecture ET la modification.
    //
    // Ce garde remplace celui qui ne couvrait que l'upload d'avatar : il porte
    // sur TOUTES les méthodes et toutes les routes qui nomment un utilisateur.
    // Un jeton Jellyfin natif n'est pas concerné (Jellyfin décide lui-même), ni
    // un jeton d'usurpation, dont c'est justement la raison d'être.
    if (incomingToken && userIdDuChemin(wildcardPath) !== null) {
      const devicePayload = await verifyDeviceToken(incomingToken);
      if (devicePayload && horsDuPerimetre(wildcardPath, devicePayload.userId)) {
        request.log.warn(
          { path: wildcardPath, method: request.method },
          "acces refuse : appareil hors de son perimetre utilisateur",
        );
        return reply.status(403).send({ error: "Forbidden" });
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

    // Cookie/query auth: inject token as X-Emby-Token if not already present
    // from headers. Use apiKeyOverride (admin API key) when the token was a
    // verified device JWT, otherwise forward the raw token (Jellyfin native).
    // Le queryToken est INDISPENSABLE ici : mpv (desktop), AVPlayer (tvOS) et
    // sendBeacon n'envoient ni header ni cookie — leur auth arrive en
    // `api_key` query, qu'on STRIPPE de l'URL forwardée (anti-fuite). Sans
    // réinjection en header, la requête partait SANS AUCUNE auth → 401
    // Jellyfin sur les routes DynamicHls (master.m3u8) → mpv end-file error
    // immédiat (transcode impossible via le proxy).
    if ((cookieToken || queryToken) && !headers["x-emby-token"] && !headers["X-Emby-Token"]) {
      headers["X-Emby-Token"] = apiKeyOverride ?? incomingToken!;
    }

    // Progressive video streams (remux) can last hours — use a long timeout.
    // HLS segments and API calls complete quickly, keep short timeout.
    const isProgressiveStream = /Videos\/.*\/stream/.test(wildcardPath);
    const timeout = isProgressiveStream ? 4 * 60 * 60 * 1000 : 120_000;

    const fetchInit: UndiciRequestInit = {
      method: effectiveMethod,
      headers,
      // Délai, MAIS AUSSI départ du client : un segment que le téléviseur a
      // cessé d'attendre après un saut n'a plus à occuper une connexion ni à
      // faire travailler ffmpeg (cf. annulationClient).
      signal: signalDeRequete(request, reply, timeout),
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

    const depart = performance.now();
    try {
      const response = await undiciFetch(targetUrl, fetchInit);
      reply.status(response.status);

      const traces = {
        chemin: wildcardPath, depart, statut: response.status,
        attendus: Number(response.headers.get("content-length")) || null,
      };
      tracerEntetes(request, traces);

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

      // Images : cache navigateur explicite (cf. imageCacheControl). Après la
      // boucle pour écraser Jellyfin, et jamais sur une 404 d'affiche.
      const imageCache = response.status < 400 ? imageCacheControl(wildcardPath) : null;
      if (imageCache) reply.header("cache-control", imageCache);

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
        // FILET. Ces corps sont déjà en mémoire : les relire ne coûte rien, et
        // aucune route de catalogue n'est censée porter la clé admin. Si l'une
        // s'y met un jour, elle est nettoyée ici et la trace le dit — plutôt que
        // de fuir en silence jusqu'au prochain audit. Le cache est clé PAR
        // JETON, donc y ranger un corps portant le jeton du demandeur est
        // cohérent : personne d'autre ne le relira.
        const brut = Buffer.from(arrayBuf).toString("utf8");
        const { corps, remplacements } = scrubAdminKey(brut, getJellyfinApiKey(), incomingToken);
        if (remplacements > 0) {
          request.log.warn(
            { path: wildcardPath, remplacements },
            "cle admin retiree d'une reponse mise en cache",
          );
        }
        const buf = remplacements > 0 ? Buffer.from(corps, "utf8") : Buffer.from(arrayBuf);
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
        // Le manifeste porte LUI AUSSI la clé admin — constaté : Jellyfin la
        // recopie dans les URI qu'il fabrique, notamment celle des tuiles de
        // trickplay (`Trickplay/320/tiles.m3u8?…&ApiKey=…`). Nettoyer une
        // réponse `PlaybackInfo` ne suffisait donc pas : la clé repartait par
        // cette porte-ci.
        //
        // AVANT la décoration, et l'ordre compte : les URL ainsi corrigées
        // portent alors le jeton du client, et `rewriteHlsManifest` les laisse
        // tranquilles au lieu d'en ajouter un second.
        const { corps, remplacements } = scrubAdminKey(text, getJellyfinApiKey(), incomingToken);
        if (remplacements > 0) {
          request.log.warn(
            { path: wildcardPath, remplacements },
            "cle admin retiree d'un manifeste HLS",
          );
        }
        const rewritten = rewriteHlsManifest(corps, incomingToken);
        reply.removeHeader("content-encoding");
        reply.removeHeader("content-length");
        reply.header("content-length", Buffer.byteLength(rewritten));
        return reply.send(rewritten);
      }

      // PlaybackInfo : la SEULE réponse qui fabrique une URL de lecture, et donc
      // la seule où Jellyfin recopie la clé d'administration qu'on vient de lui
      // présenter. Bufferisée (quelques kilo-octets) et nettoyée avant d'être
      // rendue — sans quoi la clé admin arrive dans le navigateur de chaque
      // utilisateur, en clair dans l'URL de la vidéo. cf. scrubAdminKey.ts.
      if (porteUneUrlDeLecture(wildcardPath) && response.status < 400) {
        const text = await response.text();
        const { corps, remplacements } = scrubAdminKey(
          text,
          getJellyfinApiKey(),
          incomingToken,
        );
        if (remplacements > 0) {
          // Le NOMBRE, jamais la valeur. Cette trace dit si un autre chemin se
          // met un jour à recopier la clé — c'est le seul moyen de l'apprendre
          // autrement que par un utilisateur.
          request.log.warn(
            { path: wildcardPath, remplacements },
            "cle admin retiree d'une reponse",
          );
        }
        reply.removeHeader("content-encoding");
        reply.removeHeader("content-length");
        reply.header("content-length", Buffer.byteLength(corps));
        return reply.send(corps);
      }

      const nodeStream = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
      tracerCorps(request, reply, nodeStream, traces);
      return reply.send(nodeStream);
    } catch (err) {
      const cause = tracerEchec(request, wildcardPath, depart, err);
      // Le client est parti : il n'y a personne pour lire un code d'erreur, et
      // ce n'en est pas une. On rend la main sans rien écrire sur une socket
      // déjà fermée.
      if (cause === "annule") return reply;
      if (cause === "delai-absolu") return reply.status(504).send({ message: "Jellyfin timeout" });
      return reply.status(502).send({ message: err instanceof Error ? err.message : "Proxy error" });
    }
  });
};
