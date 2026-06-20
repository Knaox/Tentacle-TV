import type {
  DeviceProfile,
  DirectPlayProfile,
  TranscodingProfile,
  CodecProfile,
  SubtitleProfile,
} from "@tentacle-tv/shared";

/**
 * DeviceProfile pour Apple TV (tvOS / AVPlayer via react-native-video).
 *
 * AVPlayer tvOS = mêmes capacités qu'iOS (copié de apps/mobile, éprouvé) :
 * - Vidéo : H.264 (AVC), HEVC (H.265) — y compris HDR/Dolby Vision sur device réel
 * - Audio : AAC, FLAC, ALAC, AC3, EAC3, MP3 (passthrough EAC3/AC3 vers l'ampli)
 * - Conteneurs DirectPlay : MP4, M4V, MOV (PAS MKV/AVI/WMV/VP9/DTS/TrueHD)
 *
 * Sans ce profil, Jellyfin tente le direct play d'un MKV → AVPlayer affiche un
 * écran noir SANS erreur exploitable. Avec, le serveur choisit en amont :
 * DirectPlay / DirectStream (remux MKV→TS, copie codecs sans ré-encodage) /
 * Transcode (VP9/AV1/DTS/TrueHD…). `forceTranscode` vide les DirectPlayProfiles
 * (fallback après une erreur codec ou choix d'un preset de qualité).
 */
export function buildTvosDeviceProfile(maxBitrate?: number, forceTranscode = false, burnInText = false): DeviceProfile {
  const directPlayProfiles: DirectPlayProfile[] = forceTranscode
    ? []
    : [
        {
          Container: "mp4,m4v,mov",
          Type: "Video",
          VideoCodec: "h264,hevc",
          AudioCodec: "aac,flac,alac,ac3,eac3,mp3",
        },
        // Audio-only
        { Container: "mp3", Type: "Audio" },
        { Container: "aac,m4a", Type: "Audio" },
        { Container: "flac", Type: "Audio" },
        { Container: "alac", Type: "Audio" },
      ];

  const transcodingProfiles: TranscodingProfile[] = [
    // HLS fMP4 — préféré par AVPlayer pour HEVC, permet le remux (copie codec)
    {
      Container: "mp4",
      Type: "Video",
      VideoCodec: "hevc,h264",
      AudioCodec: "aac,ac3,eac3",
      Protocol: "hls",
      Context: "Streaming",
      MaxAudioChannels: "6",
      MinSegments: 2,
      BreakOnNonKeyFrames: true,
      CopyTimestamps: true,
    },
    // Fallback TS segments
    {
      Container: "ts",
      Type: "Video",
      VideoCodec: "h264",
      AudioCodec: "aac",
      Protocol: "hls",
      Context: "Streaming",
      MaxAudioChannels: "6",
      MinSegments: 2,
      BreakOnNonKeyFrames: true,
      CopyTimestamps: true,
    },
    // Audio-only
    {
      Container: "mp4",
      Type: "Audio",
      AudioCodec: "aac",
      Protocol: "hls",
      Context: "Streaming",
      MaxAudioChannels: "6",
    },
  ];

  const codecProfiles: CodecProfile[] = [
    {
      Type: "Video",
      Codec: "h264",
      Conditions: [
        { Condition: "LessThanEqual", Property: "VideoLevel", Value: "52", IsRequired: false },
        { Condition: "LessThanEqual", Property: "RefFrames", Value: "16", IsRequired: false },
      ],
    },
    {
      Type: "Video",
      Codec: "hevc",
      Conditions: [
        { Condition: "LessThanEqual", Property: "VideoLevel", Value: "183", IsRequired: false },
        { Condition: "LessThanEqual", Property: "RefFrames", Value: "16", IsRequired: false },
      ],
    },
    {
      Type: "VideoAudio",
      Conditions: [
        { Condition: "LessThanEqual", Property: "AudioChannels", Value: "6", IsRequired: false },
      ],
    },
  ];

  // Sous-titres. NB Jellyfin (StreamBuilder.GetSubtitleProfile) : si le profil
  // autorise un format texte en External/Hls, il CONVERTIT n'importe quel sous-titre
  // texte vers ce format (ASS→VTT) et le livre en texte — la conversion ASS→VTT
  // laisse fuiter les balises override ({\an8}, signs…). Le serveur n'incruste
  // (Encode) QUE si AUCUNE livraison texte n'est possible.
  //   → `burnInText` (activé quand le sous-titre SÉLECTIONNÉ est ASS/SSA, cf.
  //     useTVStreamUrl.ios) retire toute livraison texte : le serveur incruste le
  //     sous-titre demandé (rendu d'origine, signs corrects). Sinon profil normal :
  //     texte natif AVPlayer (srt/vtt), pas de transcodage.
  const subtitleProfiles: SubtitleProfile[] = burnInText
    ? [
        { Format: "pgssub", Method: "Encode" },
        { Format: "dvdsub", Method: "Encode" },
        { Format: "dvbsub", Method: "Encode" },
      ]
    : [
        { Format: "vtt", Method: "External" },
        { Format: "vtt", Method: "Hls" },
        { Format: "srt", Method: "External" },
        { Format: "subrip", Method: "External" },
        // Bitmap → gravés par le serveur (burn-in)
        { Format: "pgssub", Method: "Encode" },
        { Format: "dvdsub", Method: "Encode" },
        { Format: "dvbsub", Method: "Encode" },
      ];

  return {
    MaxStreamingBitrate: maxBitrate ?? 120_000_000,
    MaxStaticBitrate: 120_000_000,
    MusicStreamingTranscodingBitrate: 384_000,
    DirectPlayProfiles: directPlayProfiles,
    TranscodingProfiles: transcodingProfiles,
    CodecProfiles: codecProfiles,
    SubtitleProfiles: subtitleProfiles,
  };
}
