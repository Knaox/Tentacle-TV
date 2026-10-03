import type { QualityKey } from "./mediaQuality";

/**
 * Ce qu'un transcodage demande à Jellyfin — débit vidéo, définition, budget
 * audio — décidé ENSEMBLE et à un seul endroit, pour toutes les plateformes.
 *
 * # Ce que Jellyfin fait d'un plafond (mesuré sur 10.11, sources 10.10 → 12)
 *
 * `VideoBitrate` devient `-maxrate` (et `-b:v` en encodage matériel) : rien ne
 * le dépasse, pas même le cœur d'une scène d'action. Au calme, l'encodeur
 * reste dessous ; dans l'action, il bute dessus et l'image part en blocs.
 *
 * La définition, elle, Jellyfin la recalcule d'après ce plafond
 * (`ResolutionNormalizer`, après avoir gonflé les petits débits) : 1080p
 * au-delà de 6 Mb/s seulement, 720p jusqu'à 1,2 Mb/s, 540p en dessous — et le
 * `MaxHeight` demandé est alors ignoré. D'où les anciens paliers « 1080p »
 * servis en 540p, et le 720p à 1,2 Mb/s qui s'effondre dans l'action.
 *
 * # La règle
 *
 * Chaque palier est une définition et un PLANCHER : le débit vidéo sous
 * lequel une scène d'action se décompose à cette définition (mesuré, cf.
 * `TRANSCODE_TIERS`). Sous le plancher, on descend d'une définition plutôt
 * que d'affamer l'encodeur : une image plus douce, jamais une image en blocs.
 * `MaxWidth` et `MaxHeight` accompagnent toujours le débit, pour que le
 * palier affiché soit celui que Jellyfin produit.
 */

export type TranscodeTierKey = Exclude<QualityKey, "original">;

export interface TranscodeTier {
  key: TranscodeTierKey;
  width: number;
  height: number;
  /** Débit vidéo visé (H.264, 24 à 30 i/s). */
  nominal: number;
  /** Débit vidéo sous lequel l'action se décompose à cette définition. */
  floor: number;
}

/**
 * Du plus lourd au plus léger. Mesuré au banc du 03/10 : l'encodeur de
 * Jellyfin (x264 veryfast, CRF 23 sous plafond) sur une scène d'action 1080p,
 * VMAF des 5 % pires images. La CIBLE approche le meilleur de la définition
 * (720p : 69,5 à 4 Mb/s pour 72,7 sans plafond ; 480p : 2 Mb/s, le débit que
 * l'action réclame d'elle-même). Le PLANCHER est le point d'équilibre avec la
 * définition du dessous : au calme, la plus haute gagne toujours (l'encodeur
 * n'y touche pas son plafond) ; dans l'action, la plus basse se décompose
 * moins. Au plancher, le pire de l'action reste à 5 points du meilleur de la
 * définition du dessous (720p à 2,5 Mb/s : 50 contre 55 ; 480p à 1,3 : 40
 * contre 45) pour une image calme nettement plus fine. En dessous, la
 * définition plus basse : plus douce, mais nette. Tous au-dessus des seuils
 * où Jellyfin réduirait lui-même la définition.
 */
export const TRANSCODE_TIERS: readonly TranscodeTier[] = [
  { key: "quality1080pHigh", width: 1920, height: 1080, nominal: 20_000_000, floor: 12_000_000 },
  { key: "quality1080p",     width: 1920, height: 1080, nominal:  8_000_000, floor:  6_500_000 },
  { key: "quality720p",      width: 1280, height:  720, nominal:  4_000_000, floor:  2_500_000 },
  { key: "quality480p",      width:  854, height:  480, nominal:  2_000_000, floor:  1_300_000 },
  { key: "quality360p",      width:  640, height:  360, nominal:  1_000_000, floor:    600_000 },
] as const;

/** Débit réservé à l'audio : 5.1 en AAC à partir du 720p, stéréo en dessous. */
export function reservedAudioBitrate(height: number | null | undefined): number {
  return (height ?? 1080) >= 720 ? 384_000 : 128_000;
}

/** Canaux audio du transcodage, sur la même frontière que le budget. */
export function audioChannelsFor(height: number | null | undefined): number {
  return (height ?? 1080) >= 720 ? 6 : 2;
}

/**
 * Efficacité d'un codec face au H.264 — les facteurs de Jellyfin
 * (`EncodingHelper.GetVideoBitrateScaleFactor`) : un HEVC à 2 Mb/s vaut un
 * H.264 à 3,3. Un transcodage sort toujours en H.264 : c'est dans cette
 * monnaie qu'on compare la source et les paliers.
 */
export function codecEfficiency(codec: string | null | undefined): number {
  const c = (codec ?? "").toLowerCase();
  if (c === "hevc" || c === "h265" || c === "vp9") return 0.6;
  if (c === "av1") return 0.5;
  return 1;
}

/** Au-delà de 30 i/s, chaque palier a besoin de plus de débit (la règle de Jellyfin). */
export function frameRateFactor(fps: number | null | undefined): number {
  return fps && fps > 30 ? Math.sqrt(fps / 30) : 1;
}

/** Largeur d'un palier d'après sa hauteur ; 16:9 pour une hauteur hors tableau. */
export function tierWidth(height: number | null | undefined): number {
  if (!height) return 1920;
  const tier = TRANSCODE_TIERS.find((t) => t.height === height);
  return tier ? tier.width : Math.round((height * 16) / 9 / 2) * 2;
}

export interface TranscodeTarget {
  videoBitrate: number;
  audioBitrate: number;
  audioChannels: number;
  maxWidth: number;
  /** Absente : la définition de la source, bornée par `maxWidth`. */
  maxHeight?: number;
}

/** Le moins qu'on demande jamais à un encodeur vidéo. */
const MIN_VIDEO_BITRATE = 300_000;

/**
 * Le transcodage d'un débit TOTAL (celui d'un palier, ou d'un repli) : la part
 * vidéo, la part audio, et la définition qui va avec. Une seule fonction pour
 * les URL fabriquées par les lecteurs natifs (`buildStreamUrl`) et pour celles
 * que rend Jellyfin aux lecteurs web et mobiles.
 */
export function transcodeTarget(totalBitrate: number, height?: number | null): TranscodeTarget {
  const audioBitrate = reservedAudioBitrate(height);
  return {
    videoBitrate: Math.max(totalBitrate - audioBitrate, MIN_VIDEO_BITRATE),
    audioBitrate,
    audioChannels: audioChannelsFor(height),
    maxWidth: tierWidth(height),
    ...(height ? { maxHeight: height } : {}),
  };
}
