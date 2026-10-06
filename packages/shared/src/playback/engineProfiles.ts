import type { TranscodingProfile } from "../types/media";
import type { EngineCapabilities } from "./engineCapabilities";
import { audioCodecParam, segmentVideoCodecs } from "./streamPlan";

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
  options: { minSegments?: number; breakOnNonKeyFrames?: boolean } = {},
): TranscodingProfile[] {
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
    Container: engine.segmentContainer,
    VideoCodec: segmentVideoCodecs(engine).join(","),
    AudioCodec: audioCodecParam(engine),
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
