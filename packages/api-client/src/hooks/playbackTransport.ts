import { fetchStreamingConfig } from "./useStreamingConfig";

const TICKS_PER_SEC = 10_000_000;
const DBG = "[Playback]";

/** Logs de debug `[WT kill]` éliminés des builds de production — NODE_ENV est
 *  inliné statiquement par Vite (web/desktop) comme par Metro (mobile/TV).
 *  Déclaration type-only : api-client (cible navigateur/RN) n'embarque pas
 *  @types/node, et le build Docker compile sans lui (TS2580 sinon). */
declare const process: { env: { NODE_ENV?: string } };
const WT_KILL_DEBUG = process.env.NODE_ENV !== "production";
function killLog(message: string, data?: unknown): void {
  if (!WT_KILL_DEBUG) return;
  if (data !== undefined) console.debug(message, data);
  else console.debug(message);
}

/**
 * Couche transport du reporting de lecture Jellyfin : POST de session
 * (start/progress/stop), URL sendBeacon, et destruction d'un transcode actif.
 * Extraction mécanique de usePlayback (limite 300 lignes/fichier).
 */

/** Convert seconds to Jellyfin ticks, guarding against NaN/Infinity. */
export function safePositionTicks(seconds: number): number {
  const ticks = Math.floor(seconds * TICKS_PER_SEC);
  return Number.isFinite(ticks) && ticks >= 0 ? ticks : 0;
}

export type JfClient = {
  fetch: <T>(path: string, init?: RequestInit, opts?: { noAuthExpiry?: boolean }) => Promise<T>;
  getBaseUrl: () => string;
  getToken: () => string | null;
  getDeviceId: () => string;
  getAuthHeader: (token?: string) => string;
  useCredentials: boolean;
  getDirectStreaming?: () => { enabled: boolean; mediaBaseUrl: string; jellyfinToken: string } | null;
  setDirectStreaming?: (config: { enabled: boolean; mediaBaseUrl: string; jellyfinToken: string } | null) => void;
  reportDirectStreamingError?: () => void;
  /**
   * Poste la télémétrie depuis la couche NATIVE, hors du moteur web.
   *
   * Injecté par l'hôte quand il en a une — c'est le cas de la coquille
   * Electron, dont l'origine `tentacle://app` n'obtiendra jamais de CORS d'un
   * serveur Jellyfin quelconque. Le processus principal, lui, n'y est pas
   * soumis. Absent sur le web, sur mobile et sur TV : ce module ne connaît
   * aucune plateforme, il se contente d'utiliser la voie qu'on lui donne.
   */
  nativeSessionPost?: (
    baseUrl: string,
    path: string,
    token: string,
    authHeader: string,
    body: string,
  ) => Promise<number>;
};

/** La route DIRECTE de télémétrie a échoué (CORS WebView typiquement) : on
 *  route les POST suivants directement via le proxy — inutile de re-payer un
 *  préflight voué à l'échec à chaque report (10 s). Reset au rechargement. */
let directTelemetryBroken = false;

/** 401/403 sur la route directe : le token Jellyfin de l'appareil est mort
 *  (révoqué/expiré côté serveur, observé EN PLEINE lecture). On redemande un
 *  token frais au backend — même canal self-healing que la récupération de
 *  stream (useTVDirectStreamRecovery) — au lieu de basculer définitivement sur
 *  le proxy : celui-ci remplace le JWT par la clé admin SANS contexte user
 *  (cassé pour le playstate en Jellyfin 10.11) → la position de reprise ne se
 *  sauvait plus du tout. Bridé à une tentative/min ; les reports suivants
 *  (~10 s) repartent en direct dès que le token frais est posé. */
let directAuthRefreshAt = 0;
const DIRECT_AUTH_REFRESH_MS = 60_000;

async function refreshDirectToken(client: JfClient): Promise<void> {
  if (!client.setDirectStreaming) return;
  if (Date.now() - directAuthRefreshAt < DIRECT_AUTH_REFRESH_MS) return;
  directAuthRefreshAt = Date.now();
  const prev = client.getDirectStreaming?.()?.jellyfinToken ?? null;
  const cfg = await fetchStreamingConfig(client.useCredentials ? "__cookie__" : client.getToken());
  if (cfg.enabled && cfg.mediaBaseUrl && cfg.jellyfinToken && cfg.jellyfinToken !== prev) {
    client.setDirectStreaming({ enabled: true, mediaBaseUrl: cfg.mediaBaseUrl, jellyfinToken: cfg.jellyfinToken });
    console.warn(DBG, "token Jellyfin rafraîchi — télémétrie directe rétablie");
  }
}

/**
 * Fire-and-forget POST to Jellyfin session endpoint.
 * Logs errors instead of silently swallowing them.
 * Uses raw fetch as fallback if client.fetch fails (to rule out client issues).
 *
 * IMPORTANT : un échec ici ne touche JAMAIS reportDirectStreamingError — la
 * télémétrie est un fetch WebView soumis au CORS, qui échoue même quand le
 * streaming média direct (mpv natif / <video>) marche parfaitement. La
 * comptabiliser désactivait le Direct Streaming au bout de 3 reports → toutes
 * les URLs médias basculaient sur le proxy (lent, et transcode HLS cassé).
 * Seul useDirectStreamingGuard (vraies erreurs <img>/<video>) fait autorité.
 */
export async function sessionPost(
  client: JfClient,
  path: string,
  body: Record<string, unknown>,
  label: string,
): Promise<void> {
  const bodyStr = JSON.stringify(body);

  // Direct Jellyfin route: bypass proxy to use the actual user's token
  // (proxy replaces user JWT with admin API key → wrong user context)
  const ds = client.getDirectStreaming?.();
  if (!directTelemetryBroken && ds?.enabled && ds.mediaBaseUrl && ds.jellyfinToken) {
    try {
      // Voie NATIVE quand l'hôte en fournit une : le `fetch` du moteur web est
      // soumis au CORS, et une origine de schéma applicatif ne l'obtiendra
      // jamais d'un Jellyfin quelconque. Sans elle, `directTelemetryBroken`
      // passait à vrai au premier report et TOUTE la session basculait sur le
      // proxy — donc plus aucune position de reprise, en silence.
      const authHeader = client.getAuthHeader(ds.jellyfinToken);
      const status = client.nativeSessionPost
        ? await client.nativeSessionPost(ds.mediaBaseUrl, path, ds.jellyfinToken, authHeader, bodyStr)
        : null;
      const res =
        status !== null
          ? { ok: status >= 200 && status < 300, status }
          : await fetch(`${ds.mediaBaseUrl}${path}`, {
              method: "POST", body: bodyStr,
              headers: {
                "Content-Type": "application/json",
                "X-Emby-Token": ds.jellyfinToken,
                "X-Emby-Authorization": authHeader,
              },
            });
      if (res.ok || res.status === 204) return;
      if (res.status === 401 || res.status === 403) {
        // Token appareil mort : refresh (bridé) — la route directe RESTE active,
        // le prochain report repartira avec le token frais. Pas de tentative
        // proxy : le playstate y est impossible (clé admin, JF 10.11).
        console.error(DBG, `${label} direct: ${res.status} — refresh du token Jellyfin demandé`);
        void refreshDirectToken(client).catch(() => {});
        return;
      }
      console.error(DBG, `${label} direct: ${res.status} — télémétrie via proxy désormais`);
      directTelemetryBroken = true;
    } catch (err: unknown) {
      console.error(DBG, `${label} direct FAILED (CORS/réseau) — télémétrie via proxy désormais:`, err instanceof Error ? err.message : String(err));
      directTelemetryBroken = true;
    }
    // Fall through to proxy on failure
  }

  // Proxy path. `noAuthExpiry` : un 401 de reporting (token Jellyfin du device
  // périmé p.ex.) ne doit JAMAIS compter dans le seuil auth-expired ni
  // déconnecter — c'est de la télémétrie fire-and-forget.
  try {
    await client.fetch(path, { method: "POST", body: bodyStr }, { noAuthExpiry: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(DBG, `${label} FAILED via client.fetch:`, msg);
    try {
      const baseUrl = client.getBaseUrl();
      const token = client.getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["X-Emby-Token"] = token;
        headers["X-Emby-Authorization"] = client.getAuthHeader();
      }
      const res = await fetch(`${baseUrl}${path}`, { method: "POST", body: bodyStr, headers });
      if (!res.ok) console.error(`[Playback] ${label} fallback fetch:`, res.status);
    } catch (err2: unknown) {
      console.error(DBG, `${label} raw fetch also FAILED:`, err2 instanceof Error ? err2.message : String(err2));
    }
  }
}

/** Build a sendBeacon-compatible URL.
 *  When using httpOnly cookies (web), no api_key needed — cookie is sent automatically.
 *  Mobile/desktop still need api_key in the URL (sendBeacon can't set headers). */
export function beaconUrl(client: JfClient, path: string): string {
  const ds = client.getDirectStreaming?.();
  if (ds?.enabled && ds.mediaBaseUrl && ds.jellyfinToken) {
    return `${ds.mediaBaseUrl}${path}?api_key=${encodeURIComponent(ds.jellyfinToken)}`;
  }
  const base = client.getBaseUrl();
  if (client.useCredentials) return `${base}${path}`;
  const token = client.getToken();
  return token ? `${base}${path}?api_key=${encodeURIComponent(token)}` : `${base}${path}`;
}

/**
 * Fire-and-forget DELETE to kill an active Jellyfin transcode (ffmpeg process).
 * Uses api_key query param since headers can't be set in keepalive/beacon contexts.
 */
export function killActiveEncoding(client: JfClient, playSessionId: string | undefined, keepalive = false): Promise<void> {
  if (!playSessionId) {
    killLog("[WT kill] killActiveEncoding SKIP — pas de playSessionId");
    return Promise.resolve();
  }
  const deviceId = client.getDeviceId();
  const path = `/Videos/ActiveEncodings?deviceId=${encodeURIComponent(deviceId)}&playSessionId=${encodeURIComponent(playSessionId)}`;

  const viaProxy = (why: string): Promise<void> => {
    killLog(`[WT kill] DELETE ActiveEncodings via PROXY (${why})`, { playSessionId, deviceId });
    const base = client.getBaseUrl();
    const token = client.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["X-Emby-Token"] = token;
      headers["X-Emby-Authorization"] = client.getAuthHeader();
    }
    return fetch(`${base}${path}`, { method: "DELETE", headers, keepalive, credentials: client.useCredentials ? "include" : undefined })
      .then((res) => {
        killLog(`[WT kill] proxy → HTTP ${res.status}${res.ok ? " (ffmpeg tué)" : " — ÉCHEC, le ffmpeg peut survivre"}`);
      })
      .catch((e) => {
        console.error("[WT kill] proxy FAILED — l'ancien ffmpeg SURVIT (risque d'écran noir au prochain stream)", e instanceof Error ? e.message : String(e));
      });
  };

  // Direct route when available (bypass proxy admin token issue) — MAIS un
  // DELETE cross-origin est bloqué par le CORS des WebViews : sans fallback
  // proxy, l'ancien ffmpeg survit et Jellyfin refuse/gèle la session suivante
  // (même DeviceId) → écran noir au changement de qualité. Toujours retomber
  // sur le proxy si l'appel direct échoue. Comme pour sessionPost : n'affecte
  // JAMAIS reportDirectStreamingError, et skip le direct dès qu'il est cassé.
  const ds = client.getDirectStreaming?.();
  if (!directTelemetryBroken && ds?.enabled && ds.mediaBaseUrl && ds.jellyfinToken) {
    killLog("[WT kill] DELETE ActiveEncodings via DIRECT", { playSessionId, deviceId });
    return fetch(`${ds.mediaBaseUrl}${path}`, {
      method: "DELETE", keepalive,
      headers: { "X-Emby-Token": ds.jellyfinToken, "X-Emby-Authorization": client.getAuthHeader(ds.jellyfinToken) },
    }).then((res) => {
      if (!res.ok) return viaProxy(`direct HTTP ${res.status}`);
      killLog("[WT kill] direct → OK (ffmpeg tué)");
    }).catch((e) => {
      directTelemetryBroken = true;
      return viaProxy(`direct erreur réseau/CORS: ${e instanceof Error ? e.message : String(e)}`);
    });
  }

  return viaProxy(directTelemetryBroken ? "direct désactivé (échec CORS antérieur)" : "pas de Direct Streaming");
}
