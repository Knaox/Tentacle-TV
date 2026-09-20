import type { TranscodingProfile } from "@tentacle-tv/shared";

/**
 * Les profils de TRANSCODAGE iOS, communs aux deux moteurs : ils ne servent
 * que dans la liste fermée des cas où le serveur travaille encore (plafond de
 * débit, palier de qualité choisi, AirPlay, Dolby Vision profil 5, échec des
 * deux lectures directes).
 */
export function iosTranscodingProfiles(): TranscodingProfile[] {
  return [
    // HLS avec fMP4 — préféré par AVPlayer pour HEVC
    //
    // JAMAIS d'ac3/eac3 ici : en COPIE Dolby vers fMP4, le muxeur de ffmpeg ne
    // connaît les paramètres du codec qu'à l'arrivée des premiers paquets, et
    // Jellyfin ne pose pas `-movflags delay_moov` — selon l'entrelacement du
    // fichier, l'init sort avec un moov de taille 0 (stsd vide) et AVPlayer
    // rend CoreMediaErrorDomain -16172 (mesuré : « Cannot write moov atom
    // before AC3 packets » dans le log de transcodage, One Piece S10E12).
    // L'audio Dolby est donc RÉENCODÉ en AAC sur ce chemin ; la lecture
    // directe MP4 (ci-dessus) garde le passthrough. Le lecteur avancé lit le
    // même HLS : la règle vaut pour lui aussi (le muxeur est côté serveur).
    {
      Container: "mp4",
      Type: "Video",
      VideoCodec: "hevc,h264",
      AudioCodec: "aac",
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
}
