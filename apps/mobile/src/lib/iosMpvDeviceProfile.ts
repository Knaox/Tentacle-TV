import type { CodecProfile, DeviceProfile, DirectPlayProfile, SubtitleProfile } from "@tentacle-tv/shared";
import { IOS_MPV_SUPPORT, supportList } from "@tentacle-tv/offline-core";
import { iosTranscodingProfiles } from "./iosTranscodingProfiles";

/** Les sous-titres que libass rend dans l'image, quel que soit le conteneur. */
const EMBEDDED_SUBTITLES = ["ass", "ssa", "subrip", "srt", "pgssub", "dvdsub", "dvbsub", "vtt", "webvtt", "mov_text"];
/** Les textes servis en fichier à part (`Stream.{format}`), au format d'origine. */
const EXTERNAL_SUBTITLES = ["ass", "ssa", "subrip", "srt", "vtt", "webvtt"];

/**
 * DeviceProfile iOS du lecteur AVANCÉ (libmpv) : tout se lit en direct —
 * conteneurs, codecs vidéo et audio de `IOS_MPV_SUPPORT`, sous-titres rendus
 * par mpv (texte stylé et images), aucun `Encode`. Les profils de transcodage
 * restent ceux du natif : ils ne servent que sous un plafond de débit ou un
 * palier de qualité choisi (liste fermée des cas où le serveur travaille).
 */
export function buildIosMpvDeviceProfile(maxBitrate?: number): DeviceProfile {
  const directPlayProfiles: DirectPlayProfile[] = [
    {
      Container: supportList(IOS_MPV_SUPPORT.containers),
      Type: "Video",
      VideoCodec: supportList(IOS_MPV_SUPPORT.videoCodecs),
      AudioCodec: supportList(IOS_MPV_SUPPORT.audioCodecs),
    },
    // Audio-only : FFmpeg démuxe tout cela.
    { Container: "mp3", Type: "Audio" },
    { Container: "aac,m4a", Type: "Audio" },
    { Container: "flac", Type: "Audio" },
    { Container: "alac", Type: "Audio" },
    { Container: "ogg,oga,opus", Type: "Audio" },
    { Container: "wav", Type: "Audio" },
  ];

  const codecProfiles: CodecProfile[] = [
    // mpv décode en logiciel ce que VideoToolbox refuse : les niveaux ne
    // bornent rien ici. Le son est mixé en PCM par mpv : 7.1 accepté.
    {
      Type: "VideoAudio",
      Conditions: [
        { Condition: "LessThanEqual", Property: "AudioChannels", Value: "8", IsRequired: false },
      ],
    },
  ];

  const subtitleProfiles: SubtitleProfile[] = [
    ...EMBEDDED_SUBTITLES.map((format): SubtitleProfile => ({ Format: format, Method: "Embed" })),
    ...EXTERNAL_SUBTITLES.map((format): SubtitleProfile => ({ Format: format, Method: "External" })),
    // Sous un plafond de débit (HLS), les textes suivent dans le manifeste.
    ...EXTERNAL_SUBTITLES.map((format): SubtitleProfile => ({ Format: format, Method: "Hls" })),
  ];

  return {
    MaxStreamingBitrate: maxBitrate ?? 120_000_000,
    MaxStaticBitrate: 120_000_000,
    MusicStreamingTranscodingBitrate: 384_000,
    DirectPlayProfiles: directPlayProfiles,
    TranscodingProfiles: iosTranscodingProfiles(),
    CodecProfiles: codecProfiles,
    SubtitleProfiles: subtitleProfiles,
  };
}
