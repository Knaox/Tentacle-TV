const TICKS_PER_SEC = 10_000_000;
const DBG = "[Playback]";

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
  reportDirectStreamingError?: () => void;
};

/**
 * Fire-and-forget POST to Jellyfin session endpoint.
 * Logs errors instead of silently swallowing them.
 * Uses raw fetch as fallback if client.fetch fails (to rule out client issues).
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
  if (ds?.enabled && ds.mediaBaseUrl && ds.jellyfinToken) {
    try {
      const res = await fetch(`${ds.mediaBaseUrl}${path}`, {
        method: "POST", body: bodyStr,
        headers: {
          "Content-Type": "application/json",
          "X-Emby-Token": ds.jellyfinToken,
          "X-Emby-Authorization": client.getAuthHeader(ds.jellyfinToken),
        },
      });
      if (res.ok || res.status === 204) return;
      console.error(DBG, `${label} direct: ${res.status}`);
      client.reportDirectStreamingError?.();
    } catch (err: unknown) {
      console.error(DBG, `${label} direct FAILED:`, err instanceof Error ? err.message : String(err));
      client.reportDirectStreamingError?.();
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
    console.info("[WT kill] killActiveEncoding SKIP — pas de playSessionId");
    return Promise.resolve();
  }
  const deviceId = client.getDeviceId();
  const path = `/Videos/ActiveEncodings?deviceId=${encodeURIComponent(deviceId)}&playSessionId=${encodeURIComponent(playSessionId)}`;

  const viaProxy = (why: string): Promise<void> => {
    console.info(`[WT kill] DELETE ActiveEncodings via PROXY (${why})`, { playSessionId, deviceId });
    const base = client.getBaseUrl();
    const token = client.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["X-Emby-Token"] = token;
      headers["X-Emby-Authorization"] = client.getAuthHeader();
    }
    return fetch(`${base}${path}`, { method: "DELETE", headers, keepalive, credentials: client.useCredentials ? "include" : undefined })
      .then((res) => {
        console.info(`[WT kill] proxy → HTTP ${res.status}${res.ok ? " (ffmpeg tué)" : " — ÉCHEC, le ffmpeg peut survivre"}`);
      })
      .catch((e) => {
        console.error("[WT kill] proxy FAILED — l'ancien ffmpeg SURVIT (risque d'écran noir au prochain stream)", e instanceof Error ? e.message : String(e));
      });
  };

  // Direct route when available (bypass proxy admin token issue) — MAIS un
  // DELETE cross-origin est bloqué par le CORS des WebViews : sans fallback
  // proxy, l'ancien ffmpeg survit et Jellyfin refuse/gèle la session suivante
  // (même DeviceId) → écran noir au changement de qualité. Toujours retomber
  // sur le proxy si l'appel direct échoue.
  const ds = client.getDirectStreaming?.();
  if (ds?.enabled && ds.mediaBaseUrl && ds.jellyfinToken) {
    console.info("[WT kill] DELETE ActiveEncodings via DIRECT", { playSessionId, deviceId });
    return fetch(`${ds.mediaBaseUrl}${path}`, {
      method: "DELETE", keepalive,
      headers: { "X-Emby-Token": ds.jellyfinToken, "X-Emby-Authorization": client.getAuthHeader(ds.jellyfinToken) },
    }).then((res) => {
      if (!res.ok) return viaProxy(`direct HTTP ${res.status}`);
      console.info("[WT kill] direct → OK (ffmpeg tué)");
    }).catch((e) => viaProxy(`direct erreur réseau/CORS: ${e instanceof Error ? e.message : String(e)}`));
  }

  return viaProxy("pas de Direct Streaming");
}
