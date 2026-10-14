/* ------------------------------------------------------------------ */
/*  Le flux d'une vidéo Dailymotion — sans publicité                   */
/*                                                                     */
/*  AlloCiné publie ses bandes-annonces sur Dailymotion. Les           */
/*  métadonnées du lecteur (`/player/metadata/video/<id>`, sans clé)   */
/*  donnent deux maîtres HLS (mesuré le 2026-10-14) :                  */
/*   - `qualities.auto` : le flux SANS publicité — le seul qu'on lit ;  */
/*   - `advertising.ad_url` (`dmxleo`) : le même, publicités insérées  */
/*     — jamais lu.                                                    */
/*  Le maître est du H.264 + AAC multiplexé en MPEG-TS (segments de    */
/*  3 s), ses URL sont signées pour l'adresse qui les a obtenues : le  */
/*  serveur les relaie, comme celles de googlevideo. Les métadonnées   */
/*  n'ont pas de CORS (un navigateur ne peut pas les lire) ; le maître */
/*  en a. Échéance des URL non documentée : une heure, prudemment.     */
/*  Chaque lecture des métadonnées passe par le garde de Dailymotion   */
/*  (`dailymotionGuard.ts` : cadence, disjoncteur).                    */
/* ------------------------------------------------------------------ */

import { recordDailymotionResponse, takeDailymotionSlot } from "./dailymotionGuard";
import { fetchUpstream } from "./relayUpstream";
import type { TrailerSource } from "./trailerSource";
import type { ExtractionResult } from "./ytExtract";

const METADATA_URL = "https://www.dailymotion.com/player/metadata/video/";
/** Les URL des maîtres viennent de Dailymotion, jamais d'ailleurs. */
const MASTER_HOST_RE = /^https:\/\/[\w.-]+\.dailymotion\.com\//;
const METADATA_TIMEOUT_MS = 8_000;
/** L'échéance des URL signées n'est dite nulle part : une heure, et une relecture si elles sont refusées avant. */
export const DAILYMOTION_SOURCE_TTL_MS = 60 * 60 * 1000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/**
 * La raison d'un refus des métadonnées — `permanent` : la vidéo n'existe pas
 * pour ce serveur (retirée, privée, bloquée dans le pays) ; `blocked` :
 * Dailymotion bride l'adresse (429), toutes échoueraient pareil.
 */
function refusalOf(error: Record<string, unknown>): Extract<ExtractionResult, { ok: false }> {
  const code = Number(error.code);
  const type = typeof error.type === "string" ? error.type : "";
  const reason = `dailymotion ${code || "?"} ${type}`.trim();
  if (code === 429) return { ok: false, permanent: false, timedOut: false, blocked: true, reason };
  const permanent = code === 403 || code === 404 || code === 410 || /not_found|forbidden|private|geo/i.test(type);
  return { ok: false, permanent, timedOut: false, reason };
}

/**
 * Les métadonnées → le flux sans publicité (`qualities.auto`, HLS). Pur.
 * Une vidéo protégée (mot de passe, privée) ou sans maître lisible : refus.
 */
export function pickDailymotionSource(metadata: unknown, now = Date.now()): ExtractionResult {
  if (!isRecord(metadata)) return { ok: false, permanent: false, timedOut: false, reason: "métadonnées illisibles" };
  if (isRecord(metadata.error)) return refusalOf(metadata.error);
  if (metadata.is_password_protected === true || metadata.private === true) {
    return { ok: false, permanent: true, timedOut: false, reason: "vidéo protégée" };
  }
  const qualities = isRecord(metadata.qualities) ? metadata.qualities : {};
  const auto = Array.isArray(qualities.auto) ? qualities.auto : [];
  const master = auto.find((q): q is { url: string } => isRecord(q) && typeof q.url === "string" && MASTER_HOST_RE.test(q.url)
    && (q.type === undefined || /mpegurl/i.test(String(q.type))));
  if (!master) return { ok: false, permanent: true, timedOut: false, reason: "aucun maître HLS" };
  const source: TrailerSource = {
    kind: "hls", masterUrl: master.url, headers: {}, expiresAt: now + DAILYMOTION_SOURCE_TTL_MS,
    // Les hauteurs se lisent dans le maître (`resolvedOf`) : les métadonnées ne les garantissent pas.
    heights: [],
  };
  return { ok: true, source, subtitles: [], clients: ["dailymotion"] };
}

/** Au-delà, la cadence ne vaut pas qu'on attende : le relais dit « indisponible », la suivante se joue. */
const MAX_PACE_WAIT_MS = 1_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Une place auprès de Dailymotion : tout de suite, ou après une attente courte
 * (deux résolutions par seconde) ; `false` : disjoncteur ouvert ou cadence
 * trop chargée — rien n'est demandé à Dailymotion.
 */
async function takeSlot(): Promise<boolean> {
  const wait = takeDailymotionSlot("stream", "interactive");
  if (wait === 0) return true;
  if (wait > MAX_PACE_WAIT_MS) return false;
  await sleep(wait);
  return takeDailymotionSlot("stream", "interactive") === 0;
}

/** Lit les métadonnées de `id` et en tire le flux sans publicité. Jamais d'exception. */
export async function extractDailymotionSource(id: string): Promise<ExtractionResult> {
  // Rien demandé à Dailymotion : ni un échec de la vidéo, ni à retenir contre elle (`skipped`).
  if (!(await takeSlot())) return { ok: false, permanent: false, timedOut: false, skipped: true, reason: "Dailymotion en pause" };
  try {
    const { res } = await fetchUpstream(`${METADATA_URL}${encodeURIComponent(id)}`, {}, { signal: AbortSignal.timeout(METADATA_TIMEOUT_MS) });
    recordDailymotionResponse(res.status);
    if (res.status === 429) {
      await res.body?.cancel();
      return { ok: false, permanent: false, timedOut: false, blocked: true, reason: "dailymotion 429" };
    }
    const body: unknown = await res.json().catch(() => null);
    const result = pickDailymotionSource(body);
    // Dailymotion dit parfois son refus dans le corps d'un 200 : le garde l'apprend aussi.
    if (!result.ok && result.blocked) recordDailymotionResponse(429);
    return result;
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return { ok: false, permanent: false, timedOut, reason: `dailymotion : ${err instanceof Error ? err.message : String(err)}` };
  }
}
