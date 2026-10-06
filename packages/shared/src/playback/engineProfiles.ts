import type { TranscodingProfile } from "../types/media";
import type { EngineCapabilities } from "./engineCapabilities";
import { audioCodecParam, segmentAudioCodecs, segmentVideoCodecs } from "./streamPlan";

/**
 * Les seuls codecs audio que Jellyfin garde dans un profil HLS en TS, quoi
 * qu'on y déclare (mesuré sur 10.11 : `aac,dts,ac3,…` revient `aac,ac3,eac3,mp3`
 * dans la `TranscodingUrl`). Une URL fabriquée par le client copie pourtant un
 * DTS en TS — c'est le tri de PlaybackInfo, pas une limite du conteneur.
 */
export const JELLYFIN_TS_PROFILE_AUDIO: ReadonlySet<string> = new Set(["aac", "ac3", "eac3", "mp3"]);

/**
 * Le conteneur du profil : celui du moteur, sauf si la piste lue ne passerait
 * pas en TS par PlaybackInfo alors que le moteur la lit et que le fMP4 la porte
 * (un DTS sous mpv) — le fMP4 garde alors le son d'origine.
 */
function profileContainer(engine: EngineCapabilities, sourceAudioCodec?: string | null): EngineCapabilities["segmentContainer"] {
  const codec = sourceAudioCodec?.toLowerCase();
  if (engine.segmentContainer !== "ts" || !codec || JELLYFIN_TS_PROFILE_AUDIO.has(codec)) return engine.segmentContainer;
  const asFmp4: EngineCapabilities = { ...engine, segmentContainer: "mp4" };
  return segmentAudioCodecs(asFmp4).includes(codec) ? "mp4" : "ts";
}

/**
 * Les profils de TRANSCODAGE d'un `DeviceProfile`, tirés de ce que lit le
 * moteur — pour les lecteurs qui laissent Jellyfin fabriquer l'URL
 * (`PlaybackInfo` : mobile, web). La règle est celle de `planStream` : le
 * HEVC en tête quand le moteur le décode, le son copié quand il le lit (liste
 * bornée aux 40 caractères que Jellyfin accepte), jamais d'AC3 en fMP4.
 *
 * ⚠️ Jellyfin prend le PREMIER profil vidéo : un profil « H.264 seul » placé
 * devant rendait le HEVC inaccessible (cas du mobile Android). Le repli
 * H.264 + AAC en TS vient donc APRÈS celui du moteur.
 */
export function engineTranscodingProfiles(
  engine: EngineCapabilities,
  options: { minSegments?: number; breakOnNonKeyFrames?: boolean; sourceAudioCodec?: string | null } = {},
): TranscodingProfile[] {
  const container = profileContainer(engine, options.sourceAudioCodec);
  const segments: EngineCapabilities = { ...engine, segmentContainer: container };
  const common = {
    Type: "Video" as const,
    Protocol: "hls",
    Context: "Streaming" as const,
    MinSegments: options.minSegments ?? 2,
    BreakOnNonKeyFrames: options.breakOnNonKeyFrames ?? true,
    CopyTimestamps: true,
  };
  const primary: TranscodingProfile = {
    ...common,
    Container: container,
    VideoCodec: segmentVideoCodecs(segments).join(","),
    AudioCodec: audioCodecParam(segments, options.sourceAudioCodec),
    MaxAudioChannels: String(engine.maxAudioChannels),
  };
  const profiles: TranscodingProfile[] = [primary];
  // Le repli universel, si le profil du moteur n'en est pas déjà un.
  if (primary.Container !== "ts" || primary.VideoCodec !== "h264" || primary.AudioCodec !== "aac") {
    profiles.push({ ...common, Container: "ts", VideoCodec: "h264", AudioCodec: "aac", MaxAudioChannels: "6" });
  }
  profiles.push({ Container: "mp4", Type: "Audio", AudioCodec: "aac", Protocol: "hls", Context: "Streaming", MaxAudioChannels: "6" });
  return profiles;
}
