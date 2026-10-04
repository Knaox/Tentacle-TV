import type { MediaSource } from "../types/media";

/**
 * POURQUOI la qualité baisse en « Auto » — une seule règle pour le mobile,
 * l'iPad, le web et le bureau ; chaque lecteur ne fait que la rendre (le
 * message éphémère, `notices/qualityDropNotice.ts`, et sa ligne dans le menu
 * Qualité).
 *
 * Trois causes, qu'on ne confond jamais :
 * - `network` : NOTRE plafond Auto — le débit MESURÉ ne porte pas le fichier
 *   (`capForBitrate`) ; le seul cas où l'on parle du réseau ;
 * - `remoteLimit` : Jellyfin a rendu un débit plus bas que celui demandé. Dans
 *   son `PlaybackInfo`, la seule réduction côté serveur est
 *   `RemoteClientBitrateLimit` (réglage du serveur, ou du compte), appliquée
 *   aux sessions hors du réseau local : c'est la limite Internet que
 *   l'administrateur a posée, pas la connexion ;
 * - `server` : le serveur CONVERTIT l'image (format, plage HDR, sous-titres
 *   incrustés) ET la sert plus bas que la source — débit vidéo ou
 *   définition. Une conversion à débit et définition intacts, ou de conteneur
 *   et d'audio seulement, n'est pas une « qualité réduite » : rien ne se dit.
 *
 * Rien en dehors du mode Auto : un palier choisi à la main est voulu.
 */

export type QualityDropCause = "network" | "remoteLimit" | "server";

/** Ce que le serveur convertit, dit en mots de spectateur. */
export type ServerConversion = "videoFormat" | "hdr" | "subtitles";

export type QualityDrop =
  | { cause: "network"; measuredBps: number; neededBps: number }
  | { cause: "remoteLimit"; limitBps: number }
  | { cause: "server"; conversion: ServerConversion };

export interface QualityDropInput {
  /** Le mode Auto est armé : « Originale », sans choix manuel pour ce titre. */
  auto: boolean;
  /**
   * Ce que le client a demandé à Jellyfin, en b/s : le palier du plafond Auto,
   * sinon le `MaxStreamingBitrate` du profil d'appareil. `null` : inconnu —
   * on ne conclut alors jamais à une limite du serveur.
   */
  requestedBps: number | null;
  /** Le plafond Auto posé sur ce flux, et la mesure qui l'a décidé. `null` : aucun. */
  cap: { measuredBps: number | null } | null;
  /** Le fichier d'origine (son débit total), tel que la fiche le connaît. */
  source: Partial<Pick<MediaSource, "Bitrate" | "MediaStreams">> | null | undefined;
  /** Le `MediaSource` servi par `PlaybackInfo` : `TranscodingUrl`, `TranscodeReasons`. */
  served: Pick<MediaSource, "TranscodingUrl" | "TranscodeReasons"> | null | undefined;
}

/** En deçà de 90 % de la demande, ce n'est plus un arrondi de Jellyfin : c'est une limite. */
export const LIMIT_TOLERANCE = 0.9;

/** Les raisons de Jellyfin qui disent « débit au-dessus de la limite ». */
const BITRATE_REASONS = new Set(["containerbitrateexceedslimit", "videobitratenotsupported"]);

/**
 * Les raisons qui RECOMPRESSENT l'image hors débit — l'audio, le conteneur
 * (remux, image copiée) et l'étiquette HEVC ne la touchent pas.
 */
const CONVERSIONS: readonly [RegExp, ServerConversion][] = [
  [/^subtitlecodecnotsupported$/, "subtitles"],
  [/^videorangetypenotsupported$/, "hdr"],
  [/^(video(?!codectagnotsupported|bitratenotsupported)|refframes|anamorphic|interlaced)/, "videoFormat"],
];

/** Jellyfin 10.9+ rend un tableau ; avant, une chaîne à virgules. */
function reasonList(raw: string[] | string | undefined | null): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : raw.split(",");
  return list.map((reason) => reason.trim().toLowerCase()).filter(Boolean);
}

function urlParam(url: string, name: string): string | null {
  const match = new RegExp(`[?&]${name}=([^&]*)`, "i").exec(url);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * Les raisons du transcodage servi. Jellyfin ne remplit pas toujours le champ
 * (mesuré vide sur 10.10), mais les recopie dans la query de `TranscodingUrl`.
 */
export function servedReasons(served: QualityDropInput["served"]): string[] {
  const declared = reasonList(served?.TranscodeReasons);
  if (declared.length > 0 || !served?.TranscodingUrl) return declared;
  return reasonList(urlParam(served.TranscodingUrl, "TranscodeReasons"));
}

/** Le débit servi (vidéo + audio), lu dans la `TranscodingUrl` ; `null` s'il n'y figure pas. */
export function servedBitrate(served: QualityDropInput["served"]): number | null {
  const url = served?.TranscodingUrl;
  if (!url) return null;
  const video = Number(urlParam(url, "VideoBitrate"));
  if (!Number.isFinite(video) || video <= 0) return null;
  const audio = Number(urlParam(url, "AudioBitrate"));
  return video + (Number.isFinite(audio) && audio > 0 ? audio : 0);
}

/** Le flux converti est-il plus pauvre que la source : débit vidéo ou définition plus bas ? */
export function conversionLowersQuality(
  source: QualityDropInput["source"],
  served: QualityDropInput["served"],
): boolean {
  const url = served?.TranscodingUrl;
  const video = source?.MediaStreams?.find((stream) => stream.Type === "Video");
  if (!url || !video) return false;
  const servedVideo = Number(urlParam(url, "VideoBitrate"));
  if (video.BitRate && Number.isFinite(servedVideo) && servedVideo > 0 && servedVideo < video.BitRate * LIMIT_TOLERANCE) return true;
  const maxHeight = Number(urlParam(url, "MaxHeight"));
  const maxWidth = Number(urlParam(url, "MaxWidth"));
  if (video.Height && Number.isFinite(maxHeight) && maxHeight > 0 && maxHeight < video.Height) return true;
  return !!video.Width && Number.isFinite(maxWidth) && maxWidth > 0 && maxWidth < video.Width;
}

function conversionOf(reasons: readonly string[]): ServerConversion | null {
  for (const [pattern, conversion] of CONVERSIONS) {
    if (reasons.some((reason) => pattern.test(reason))) return conversion;
  }
  return null;
}

export function qualityDrop(input: QualityDropInput): QualityDrop | null {
  if (!input.auto) return null;
  const transcoding = !!input.served?.TranscodingUrl;
  const reasons = transcoding ? servedReasons(input.served) : [];

  // La limite du serveur d'abord : c'est elle qui tient le débit, même sous
  // notre plafond (une limite Internet plus basse que la mesure).
  const served = servedBitrate(input.served);
  const limited = reasons.some((reason) => BITRATE_REASONS.has(reason));
  if (limited && served !== null && input.requestedBps !== null && served < input.requestedBps * LIMIT_TOLERANCE) {
    return { cause: "remoteLimit", limitBps: served };
  }

  const measured = input.cap?.measuredBps ?? null;
  const needed = input.source?.Bitrate ?? null;
  if (input.cap && measured !== null && measured > 0 && needed !== null && needed > 0) {
    return { cause: "network", measuredBps: measured, neededBps: needed };
  }

  const conversion = transcoding && conversionLowersQuality(input.source, input.served) ? conversionOf(reasons) : null;
  return conversion ? { cause: "server", conversion } : null;
}

/** Deux baisses de même cause et mêmes chiffres disent la même chose : on ne la répète pas. */
export function qualityDropKey(drop: QualityDrop): string {
  switch (drop.cause) {
    case "network": return "network";
    case "remoteLimit": return `remoteLimit:${Math.round(drop.limitBps / 100_000)}`;
    case "server": return `server:${drop.conversion}`;
  }
}

/**
 * Mégabits par seconde, arrondis pour la lecture : une décimale sous 10, aucune
 * au-dessus — écrits dans la langue de l'interface (« 6,4 » en français).
 */
export function formatMbps(bps: number, locale?: string): string {
  const value = bps / 1e6;
  const digits = value >= 10 ? 0 : 1;
  try {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  } catch {
    return value.toFixed(digits);
  }
}

export interface QualityDropText {
  /** Clé qualifiée de l'espace `player` : la phrase du message éphémère. */
  key: string;
  /** Clé de la ligne courte du menu Qualité, sous « Auto ». */
  menuKey: string;
  values: Record<string, string>;
}

/** Les phrases de chaque cause — le message, et sa ligne relisible dans le menu. */
export function qualityDropText(drop: QualityDrop, locale?: string): QualityDropText {
  switch (drop.cause) {
    case "network":
      return {
        key: "player:qualityDrop.network",
        menuKey: "player:qualityDropMenu.network",
        values: { measured: formatMbps(drop.measuredBps, locale), source: formatMbps(drop.neededBps, locale) },
      };
    case "remoteLimit":
      return {
        key: "player:qualityDrop.remoteLimit",
        menuKey: "player:qualityDropMenu.remoteLimit",
        values: { limit: formatMbps(drop.limitBps, locale) },
      };
    case "server":
      return {
        key: `player:qualityDrop.server_${drop.conversion}`,
        menuKey: `player:qualityDropMenu.server_${drop.conversion}`,
        values: {},
      };
  }
}
