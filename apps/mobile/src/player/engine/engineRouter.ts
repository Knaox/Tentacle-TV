import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import {
  ANDROID_NATIVE_SUPPORT,
  IOS_NATIVE_SUPPORT,
  supportsToken,
  type PlatformMediaSupport,
} from "@tentacle-tv/offline-core";
import type { MobilePlatform, PlayerEngineKind, VideoEngineSetting } from "./types";

/**
 * Le routeur de moteur : pur, sans React ni `Platform.OS`, testé. Il décide
 * AVANT PlaybackInfo, à partir des flux de l'élément — le profil d'appareil
 * envoyé à Jellyfin est celui du moteur choisi. On garde le lecteur système
 * là où il gagne (AirPlay, Dolby Vision profil 5, Atmos du système, HDR
 * Android) et le lecteur avancé prend tout ce que le système ne lit pas tel
 * quel. La décision vaut pour la session, à deux exceptions près tenues par
 * la façade `usePlayerEngine` : le repli après un échec de lecture, et
 * AirPlay, réactif dans les deux sens.
 */
export type EngineReason =
  | "setting"
  | "mpv-unavailable"
  | "airplay"
  | "dolby-vision-p5"
  | "system-atmos"
  | "av1-software"
  | "native-media"
  | "container"
  | "video-codec"
  | "video-bit-depth"
  | "audio-codec"
  | "subtitle-styled"
  | "subtitle-codec"
  | "fallback";

export interface EngineRouterInput {
  platform: MobilePlatform;
  setting: VideoEngineSetting;
  mpvAvailable: boolean;
  /** La sortie audio est déjà un récepteur AirPlay. */
  airPlayActive: boolean;
  /** iOS : laisser le système décoder l'E-AC-3 Atmos (opt-in, remux accepté). */
  preferSystemAtmos: boolean;
  /** Android : un ASS choisi va au lecteur avancé, qui le rend avec ses styles. */
  styledSubtitlesViaMpv: boolean;
  /** iOS : AV1 décodé par la puce (A17 Pro et plus). */
  av1Hardware: boolean;
  /** `MediaSource.Container`, parfois une liste (« mov,mp4,m4a »). */
  container: string | undefined;
  streams: readonly JfStream[];
  /** Index Jellyfin ; -1 = la piste par défaut. */
  selectedAudioIndex: number;
  /** Index Jellyfin ; -1 = aucun sous-titre. */
  selectedSubtitleIndex: number;
}

export interface EngineDecision {
  engine: PlayerEngineKind;
  reason: EngineReason;
}

const native = (reason: EngineReason): EngineDecision => ({ engine: "native", reason });
const mpv = (reason: EngineReason): EngineDecision => ({ engine: "mpv", reason });

function codecOf(stream: JfStream | undefined): string {
  const codec = (stream?.Codec ?? "").toLowerCase();
  return codec === "h265" ? "hevc" : codec;
}

function audioStream(streams: readonly JfStream[], index: number): JfStream | undefined {
  const audios = streams.filter((s) => s.Type === "Audio");
  if (index >= 0) {
    const chosen = audios.find((s) => s.Index === index);
    if (chosen) return chosen;
  }
  return audios.find((s) => s.IsDefault) ?? audios[0];
}

function subtitleStream(streams: readonly JfStream[], index: number): JfStream | undefined {
  if (index < 0) return undefined;
  return streams.find((s) => s.Type === "Subtitle" && s.Index === index);
}

/**
 * Dolby Vision profil 5 : couche de base IPT, sans repli HDR10 — la voie
 * display-layer du lecteur avancé la rend violette. Un `VideoRangeType` égal
 * à « DOVI » seul (sans HDR10/HLG/SDR compatible) en est le signe quand le
 * profil manque.
 */
export function isDolbyVisionProfile5(video: JfStream | undefined): boolean {
  if (!video) return false;
  if (video.DvProfile === 5) return true;
  if (video.DvProfile != null) return false;
  const range = typeof video.VideoRangeType === "string" ? video.VideoRangeType.toUpperCase() : "";
  return range === "DOVI";
}

/** E-AC-3 avec Atmos (JOC) : Jellyfin le dit dans le titre ou le profil. */
export function isEac3Atmos(audio: JfStream | undefined): boolean {
  if (!audio || codecOf(audio) !== "eac3") return false;
  const text = `${audio.DisplayTitle ?? ""} ${audio.Title ?? ""} ${audio.Profile ?? ""}`.toLowerCase();
  return text.includes("atmos") || text.includes("joc");
}

/** Le lecteur système a-t-il une chance de lire ce fichier en direct ? */
export function nativeMediaPlausible(
  platform: MobilePlatform,
  container: string | undefined,
  streams: readonly JfStream[],
): boolean {
  const support = platform === "ios" ? IOS_NATIVE_SUPPORT : ANDROID_NATIVE_SUPPORT;
  const video = streams.find((s) => s.Type === "Video");
  return supportsToken(support.containers, container) && (!video || support.videoCodecs.has(codecOf(video)));
}

function decideIos(input: EngineRouterInput, support: PlatformMediaSupport): EngineDecision {
  const video = input.streams.find((s) => s.Type === "Video");
  const audio = audioStream(input.streams, input.selectedAudioIndex);
  const subtitle = subtitleStream(input.streams, input.selectedSubtitleIndex);

  if (isDolbyVisionProfile5(video)) return native("dolby-vision-p5");
  if (input.preferSystemAtmos && isEac3Atmos(audio)) return native("system-atmos");
  const videoCodec = codecOf(video);
  // AV1 sans la puce : le libdav1d de MPVKit (sans assembleur) plante à
  // l'ouverture du décodeur — mesuré au simulateur sur quatre fichiers 10 bits,
  // quel que soit le nombre de fils — et un AV1 logiciel viderait la batterie.
  // Le lecteur système le demande au serveur ; à lever quand un appareil sans
  // puce AV1 aura prouvé le contraire.
  if (video && videoCodec === "av1" && !input.av1Hardware) return native("av1-software");
  if (!supportsToken(support.containers, input.container)) return mpv("container");
  if (video && !support.videoCodecs.has(videoCodec) && videoCodec !== "av1") return mpv("video-codec");
  // AVPlayer ne décode que le H.264 8 bits.
  if (video && videoCodec === "h264" && (video.BitDepth ?? 8) > 8) return mpv("video-bit-depth");
  if (audio && !support.audioCodecs.has(codecOf(audio))) return mpv("audio-codec");
  if (subtitle && !support.subtitleCodecs.has(codecOf(subtitle))) return mpv("subtitle-codec");
  return native("native-media");
}

function decideAndroid(input: EngineRouterInput, support: PlatformMediaSupport): EngineDecision {
  const video = input.streams.find((s) => s.Type === "Video");
  const audio = audioStream(input.streams, input.selectedAudioIndex);
  const subtitle = subtitleStream(input.streams, input.selectedSubtitleIndex);

  if (!supportsToken(support.containers, input.container)) return mpv("container");
  if (video && !support.videoCodecs.has(codecOf(video))) return mpv("video-codec");
  if (audio && !support.audioCodecs.has(codecOf(audio))) return mpv("audio-codec");
  if (subtitle) {
    const codec = codecOf(subtitle);
    if ((codec === "ass" || codec === "ssa") && input.styledSubtitlesViaMpv) return mpv("subtitle-styled");
    if (!support.subtitleCodecs.has(codec)) return mpv("subtitle-codec");
  }
  return native("native-media");
}

export function decideEngine(input: EngineRouterInput): EngineDecision {
  if (!input.mpvAvailable) return native("mpv-unavailable");
  // AirPlay l'emporte sur tout réglage : le lecteur avancé ne diffuse pas.
  if (input.airPlayActive) return native("airplay");
  if (input.setting === "native") return native("setting");
  if (input.setting === "mpv") return mpv("setting");
  return input.platform === "ios"
    ? decideIos(input, IOS_NATIVE_SUPPORT)
    : decideAndroid(input, ANDROID_NATIVE_SUPPORT);
}
