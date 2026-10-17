import { trailerReportBody, trailerResolveQuery, type RelayedTrailerPlayback } from "@tentacle-tv/shared";
import { parseTrailerResolve, type TrailerStream } from "@tentacle-tv/tv-core";

export type { TrailerStream };

/**
 * La résolution d'une bande-annonce (YouTube, ou Dailymotion pour AlloCiné) en un flux qu'AVPlayer sait lire
 * (Apple TV) : `GET /api/trailers/resolve` du serveur, qui l'extrait (yt-dlp)
 * puis le RELAIE — le téléviseur ne lit plus googlevideo directement, dont
 * les URL sont liées à l'adresse IP du serveur. `path` se pose derrière
 * l'adresse que la TV connaît (un serveur derrière un mandataire n'a pas
 * forcément la même vue de lui-même) ; `url` reste le repli d'un serveur
 * plus ancien, qui rendait l'URL googlevideo.
 *
 * Bornée dans le temps : une connexion peut rester ouverte sans réponse —
 * sans borne, l'écran restait au chargement indéfiniment.
 *
 * `Promise.race`, pas d'`AbortController` : même arbitrage que
 * `fetchWithRetry` (un signal a déjà cassé des requêtes sur certains runtimes
 * React Native). La requête abandonnée va à son terme, son résultat est
 * ignoré — et le serveur garde le flux trouvé entre-temps : le geste suivant
 * le lit aussitôt.
 */

/**
 * Au-delà, l'écran dit « indisponible ». Une résolution prend deux secondes
 * d'ordinaire (rien, préparée dès la fiche) ; le serveur borne ses deux
 * passes d'extraction à vingt secondes chacune.
 */
export const RESOLVE_TIMEOUT_MS = 45_000;

/**
 * Le flux (Auto, et avec `trailers.player` ses qualités et ses pistes de
 * sous-titres — `parseTrailerResolve`, tv-core), ou la raison de son absence —
 * pour les traces et le compte rendu, jamais pour l'écran.
 */
export type ResolveResult = { ok: true; stream: TrailerStream } | { ok: false; reason: string };

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

async function request(serverUrl: string, token: string, video: RelayedTrailerPlayback, lang: string): Promise<ResolveResult> {
  try {
    // `lang` ne fait que trier les sous-titres (l'interface en tête) ; un serveur d'avant l'ignore.
    const query = `${trailerResolveQuery(video)}&lang=${encodeURIComponent(lang)}`;
    const res = await fetch(`${serverUrl}/api/trailers/resolve?${query}`, { headers: authHeaders(token) });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const stream = parseTrailerResolve(await res.json(), serverUrl);
    if (!stream) return { ok: false, reason: "réponse sans flux" };
    return { ok: true, stream };
  } catch (err) {
    return { ok: false, reason: `réseau : ${String(err)}` };
  }
}

export function resolveTrailerStream(serverUrl: string, token: string, video: RelayedTrailerPlayback, lang = "en"): Promise<ResolveResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ResolveResult>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, reason: `pas de réponse en ${RESOLVE_TIMEOUT_MS / 1000} s` }), RESOLVE_TIMEOUT_MS);
  });
  return Promise.race([request(serverUrl, token, video, lang), timeout]).finally(() => clearTimeout(timer));
}

/**
 * Fait préparer la bande-annonce par le serveur (extraction, premières
 * listes) pendant qu'on lit la fiche. Sans réponse attendue ; un serveur
 * plus ancien répond 404, sans conséquence.
 */
export function prepareTrailerStream(serverUrl: string, token: string, video: RelayedTrailerPlayback): void {
  fetch(`${serverUrl}/api/trailers/prepare?${trailerResolveQuery(video)}`, { headers: authHeaders(token) }).catch(() => undefined);
}

/** L'issue d'une lecture : la première image et son délai, ou l'échec et sa raison. */
export interface TrailerOutcome {
  ok: boolean;
  /** Depuis l'ouverture de l'écran de la bande-annonce. */
  ms: number;
  reason?: string;
}

/**
 * Le compte rendu d'une lecture au serveur, qui le consigne : c'est ce qui
 * dira, en production, que YouTube a de nouveau changé. Sans réponse attendue.
 */
export function reportTrailerOutcome(serverUrl: string, token: string, video: RelayedTrailerPlayback, outcome: TrailerOutcome): void {
  fetch(`${serverUrl}/api/trailers/report`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(trailerReportBody(video, outcome)),
  }).catch(() => undefined);
}
