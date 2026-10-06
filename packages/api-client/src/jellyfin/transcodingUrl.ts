import {
  TRANSCODE_TIERS, bestTierForBudget, keptAudioCopyBitrate, transcodeTarget,
  type AudioSource, type MediaSource,
} from "@tentacle-tv/shared";

/**
 * Les URL de transcodage que rend JELLYFIN (`TranscodingUrl` de PlaybackInfo :
 * lecteurs web, mobiles et LG), et le palier qu'on y pose. Les URL que
 * fabriquent les lecteurs natifs, elles, naissent dans `urlBuilder.ts` — la
 * même règle (`planStream`, shared) décide des deux.
 */

/** Les paramètres qu'un palier impose à une URL de transcodage, quelle que soit leur casse d'origine. */
const TARGET_PARAMS = ["VideoBitrate", "AudioBitrate", "TranscodingMaxAudioChannels", "MaxWidth", "MaxHeight"];

/** Ce que l'URL de Jellyfin prévoit pour le son (`keptAudioCopyBitrate`, shared). */
function servedAudio(url: string) {
  const codecs = stringParam(url, "AudioCodec");
  return {
    audioCodecs: codecs ? codecs.toLowerCase().split(",") : [],
    audioBitrate: numericParam(url, "AudioBitrate"),
    allowCopy: stringParam(url, "AllowAudioStreamCopy")?.toLowerCase() !== "false",
  };
}

/** La piste audio que sert l'URL : son `AudioStreamIndex`, sinon celle par défaut de la source. */
function servedAudioStream(url: string, source: MediaSource | null | undefined): AudioSource | null {
  const audio = source?.MediaStreams?.filter((s) => s.Type === "Audio") ?? [];
  const index = numericParam(url, "AudioStreamIndex") ?? source?.DefaultAudioStreamIndex;
  return audio.find((s) => s.Index === index) ?? audio[0] ?? null;
}

export interface TranscodeTier {
  /** Débit TOTAL du palier, son compris. */
  totalBitrate: number;
  height?: number | null;
}

/**
 * Pose un palier de qualité sur l'URL de transcodage que Jellyfin a rendue
 * (`TranscodingUrl` de PlaybackInfo, lecteurs web, mobiles et LG).
 *
 * Jellyfin y écrit `VideoBitrate = plafond − audio` mais aucune définition :
 * au moment du manifeste, il la recalcule d'après ce débit et sert du 720p à
 * 1,2 Mb/s, qui part en blocs à la première scène d'action. On y impose donc
 * le débit, la définition et l'audio du palier — les mêmes que `buildStreamUrl`
 * pose sur les URL des lecteurs natifs (`planStream`, shared).
 *
 * Le son que Jellyfin a prévu de COPIER (le profil déclare son codec) le reste
 * s'il tient dans le palier : son débit sort alors du budget de l'image, au
 * lieu d'un `AudioBitrate=384000` qui faisait convertir un DTS en AAC avec la
 * raison « codec non pris en charge ». Le reste de l'URL est rendu tel quel, à
 * l'octet près : session, pistes, profils de codecs, plages HDR.
 */
export function applyTranscodeTarget(url: string, tier: TranscodeTier, source?: MediaSource | null): string {
  const q = url.indexOf("?");
  if (q < 0) return url;
  const audio = servedAudioStream(url, source);
  const copied = keptAudioCopyBitrate(servedAudio(url), audio, tier.totalBitrate);
  const target = transcodeTarget(tier.totalBitrate, tier.height, copied);
  const replaced = new Set(TARGET_PARAMS.map((k) => k.toLowerCase()));
  const kept = url
    .slice(q + 1)
    .split("&")
    .filter((pair) => pair !== "" && !replaced.has(pair.split("=")[0].toLowerCase()));
  // Copié, le son garde ses canaux : c'est la piste d'origine qui part.
  const channels = copied !== null ? Math.max(audio?.Channels ?? 2, target.audioChannels) : target.audioChannels;
  kept.push(
    `VideoBitrate=${target.videoBitrate}`,
    `AudioBitrate=${target.audioBitrate}`,
    `TranscodingMaxAudioChannels=${channels}`,
    `MaxWidth=${target.maxWidth}`,
  );
  if (target.maxHeight) kept.push(`MaxHeight=${target.maxHeight}`);
  return `${url.slice(0, q)}?${kept.join("&")}`;
}

/** Sous ce débit vidéo, Jellyfin quitte le 1080p et choisit seul une définition qu'il affame. */
const STARVING_BELOW = TRANSCODE_TIERS.find((t) => t.key === "quality1080p")?.floor ?? 6_500_000;

/** Un paramètre numérique d'une URL de transcodage, quelle que soit sa casse. */
function numericParam(url: string, name: string): number | null {
  const match = new RegExp(`[?&]${name}=(\\d+)`, "i").exec(url);
  return match ? Number(match[1]) : null;
}

/** Un paramètre texte d'une URL de transcodage, quelle que soit sa casse. */
function stringParam(url: string, name: string): string | null {
  const match = new RegExp(`[?&]${name}=([^&]*)`, "i").exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Le transcodage que JELLYFIN a plafonné de lui-même, en « Originale » : la
 * limite de débit du streaming Internet (du serveur ou du compte) s'applique
 * aux lecteurs distants sans qu'aucun palier n'ait été choisi. Jellyfin écrit
 * alors `VideoBitrate = limite − audio` et choisit seul la définition — le
 * 720p à 1,2 Mb/s qui part en blocs dans l'action. Quand le débit permis est
 * sous celui de la source ET sous le plancher du 1080p — la zone où Jellyfin
 * affame l'encodeur —, on y pose le meilleur palier qui tient dans cette
 * limite (`bestTierForBudget`, shared). Sinon l'URL reste celle de Jellyfin :
 * copie, remux, transcodage de codec à plein débit, ou plafond assez haut pour
 * qu'il garde lui-même le 1080p, voire la 4K d'un téléviseur.
 */
export function fitServerCappedTranscode(url: string, source: MediaSource | null | undefined): string {
  const videoBitrate = numericParam(url, "VideoBitrate");
  const video = source?.MediaStreams?.find((s) => s.Type === "Video");
  const sourceVideoBitrate = video?.BitRate ?? source?.Bitrate;
  if (!videoBitrate || !sourceVideoBitrate || videoBitrate >= sourceVideoBitrate) return url;
  if (videoBitrate >= STARVING_BELOW) return url;
  const tier = bestTierForBudget(source, videoBitrate + (numericParam(url, "AudioBitrate") ?? 0));
  return tier?.bitrate ? applyTranscodeTarget(url, { totalBitrate: tier.bitrate, height: tier.height }, source) : url;
}
