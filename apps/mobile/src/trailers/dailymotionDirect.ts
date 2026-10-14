/**
 * Dailymotion lu par le TÉLÉPHONE lui-même, sans passer par le serveur.
 *
 * Les métadonnées du lecteur (`/player/metadata/video/<id>`, sans clé) n'ont
 * pas de CORS : un navigateur ne peut pas les lire, une app native si. Elles
 * donnent deux maîtres HLS (mesuré le 2026-10-14) : `qualities.auto`, SANS
 * publicité — le seul qu'on lit — et `advertising.ad_url`, le même avec les
 * publicités insérées — jamais lu. Les URL sont signées pour l'adresse qui les
 * a obtenues : c'est celle du téléphone, qui les lit aussitôt. Tentacle ne
 * voit rien passer — utile hors de la maison. La règle est celle du relais du
 * serveur (`dailymotionSource.ts`) ; en cas d'échec, l'écran passe par lui.
 */

const METADATA_URL = "https://www.dailymotion.com/player/metadata/video/";
/** Les maîtres viennent de Dailymotion, jamais d'ailleurs. */
const MASTER_HOST = /^https:\/\/[\w.-]+\.dailymotion\.com\//;
const TIMEOUT_MS = 8_000;
const VIDEO_ID = /^[a-zA-Z0-9]{5,12}$/;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Les métadonnées → l'adresse du maître sans publicité, ou `null` (erreur, vidéo protégée, aucun maître). Pur. */
export function pickDailymotionMaster(metadata: unknown): string | null {
  if (!isRecord(metadata) || isRecord(metadata.error)) return null;
  if (metadata.is_password_protected === true || metadata.private === true) return null;
  const qualities = isRecord(metadata.qualities) ? metadata.qualities : {};
  const auto = Array.isArray(qualities.auto) ? qualities.auto : [];
  for (const quality of auto) {
    if (!isRecord(quality) || typeof quality.url !== "string" || !MASTER_HOST.test(quality.url)) continue;
    if (quality.type !== undefined && !/mpegurl/i.test(String(quality.type))) continue;
    return quality.url;
  }
  return null;
}

/** Le maître sans publicité de la vidéo, lu par l'appareil ; `null` : à demander au relais du serveur. */
export async function resolveDailymotionDirect(videoId: string): Promise<string | null> {
  if (!VIDEO_ID.test(videoId)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${METADATA_URL}${encodeURIComponent(videoId)}`, { signal: controller.signal });
    if (!res.ok) return null;
    return pickDailymotionMaster(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
