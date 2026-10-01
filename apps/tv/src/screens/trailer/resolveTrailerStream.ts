/**
 * La résolution d'une bande-annonce YouTube en un flux qu'AVPlayer sait lire
 * (Apple TV) : `GET /api/trailers/resolve` du serveur, qui passe par yt-dlp.
 *
 * Bornée dans le temps : le serveur retente l'extraction jusqu'à cinq fois
 * (vingt secondes chacune au pire) et une connexion peut rester ouverte sans
 * réponse — sans borne, l'écran restait au chargement indéfiniment.
 *
 * `Promise.race`, pas d'`AbortController` : même arbitrage que
 * `fetchWithRetry` (un signal a déjà cassé des requêtes sur certains runtimes
 * React Native). La requête abandonnée va à son terme, son résultat est
 * ignoré — et le serveur garde en cache un flux HLS trouvé entre-temps : le
 * geste suivant le lit aussitôt.
 */

/**
 * Au-delà, l'écran dit « indisponible ». Couvre trois ou quatre extractions
 * lentes ; un mandataire HTTP coupe de toute façon souvent à 60 s.
 */
export const RESOLVE_TIMEOUT_MS = 45_000;

const HLS_MIME = "application/vnd.apple.mpegurl";

export interface TrailerStream {
  url: string;
  /** `m3u8` pour un manifeste HLS : une URL googlevideo n'a pas d'extension que le lecteur reconnaîtrait. */
  type?: "m3u8";
}

/** Le flux, ou la raison de son absence — pour les traces, jamais pour l'écran. */
export type ResolveResult = { ok: true; stream: TrailerStream } | { ok: false; reason: string };

async function request(serverUrl: string, token: string, ytId: string): Promise<ResolveResult> {
  try {
    const res = await fetch(`${serverUrl}/api/trailers/resolve?ytId=${encodeURIComponent(ytId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const data = (await res.json()) as { url?: unknown; mimeType?: unknown };
    if (typeof data.url !== "string" || !data.url.startsWith("http")) return { ok: false, reason: "réponse sans flux" };
    return { ok: true, stream: { url: data.url, type: data.mimeType === HLS_MIME ? "m3u8" : undefined } };
  } catch (err) {
    return { ok: false, reason: `réseau : ${String(err)}` };
  }
}

export function resolveTrailerStream(serverUrl: string, token: string, ytId: string): Promise<ResolveResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ResolveResult>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, reason: `pas de réponse en ${RESOLVE_TIMEOUT_MS / 1000} s` }), RESOLVE_TIMEOUT_MS);
  });
  return Promise.race([request(serverUrl, token, ytId), timeout]).finally(() => clearTimeout(timer));
}
