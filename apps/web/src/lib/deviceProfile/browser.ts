import type { DeviceProfile, DirectPlayProfile, TranscodingProfile, CodecProfile } from "@tentacle-tv/shared";
import {
  dynamicRangeCondition, CONDITIONS_HEVC, h264Conditions, MUSIC_BITRATE,
  AUDIO_PROFILE_6_CHANNELS, AUDIO_ONLY_PROFILE,
  hlsFmp4Profile, hlsTsProfile, bitmapSubtitles, TEXT_SUBTITLES, type WebProfileOptions,
} from "./blocks";
import {
  canPlayAac, canPlayAc3, canPlayAv1, canPlayContainer, canPlayEac3, canPlayFlac,
  canPlayH264, canPlayHevc, canPlayMp3, canPlayOpus, canPlayVp9, isChromium,
  nativeAac, nativeAc3, nativeAv1, nativeEac3, nativeFlac, nativeH264, nativeHevc,
  nativeMp3, nativeOpus, nativeVp9,
  supportedDynamicRanges,
} from "./codecs";

export function buildBrowserDeviceProfile(
  maxBitrate?: number,
  options?: WebProfileOptions,
): DeviceProfile {
  // ── Deux jeux de capacités, et la distinction n'est pas cosmétique ──
  //
  // Une lecture DIRECTE est faite par `<video src>`, donc par le décodeur natif
  // du moteur ; un flux TRANSCODÉ passe par hls.js, donc par MSE. Les deux ne
  // répondent pas la même chose : Chrome sous Windows décode l'E-AC3
  // nativement et le refuse en MSE.
  //
  // Servir la liste MSE aux DirectPlayProfiles — ce qui se faisait ici —
  // retirait donc l'E-AC3 d'un MKV que le navigateur aurait ouvert tel quel.
  // Jellyfin n'avait plus d'autre choix que le remux HLS, et de là venait tout
  // le reste : conversion audio, puis tone mapping, puis ré-encodage 4K, sur un
  // fichier qui ne demandait rien. jellyfin-web sépare les deux listes
  // (`videoAudioCodecs` face à `hlsInFmp4VideoAudioCodecs`) pour cette raison.
  const nativeVideoCodecs: string[] = [];
  if (nativeH264()) nativeVideoCodecs.push("h264");
  if (nativeHevc()) nativeVideoCodecs.push("hevc");
  if (nativeVp9())  nativeVideoCodecs.push("vp9");
  if (nativeAv1())  nativeVideoCodecs.push("av1");

  const nativeAudioCodecs: string[] = [];
  if (nativeAac())  nativeAudioCodecs.push("aac");
  if (nativeMp3())  nativeAudioCodecs.push("mp3");
  if (nativeAc3())  nativeAudioCodecs.push("ac3");
  if (nativeEac3()) nativeAudioCodecs.push("eac3");
  if (nativeFlac()) nativeAudioCodecs.push("flac");
  if (nativeOpus()) nativeAudioCodecs.push("opus");

  const videoCodecs: string[] = [];
  if (canPlayH264()) videoCodecs.push("h264");
  if (canPlayHevc()) videoCodecs.push("hevc");
  if (canPlayVp9())  videoCodecs.push("vp9");
  if (canPlayAv1())  videoCodecs.push("av1");

  const audioCodecs: string[] = [];
  if (canPlayAac())  audioCodecs.push("aac");
  if (canPlayMp3())  audioCodecs.push("mp3");
  if (canPlayAc3())  audioCodecs.push("ac3");
  if (canPlayEac3()) audioCodecs.push("eac3");
  if (canPlayFlac()) audioCodecs.push("flac");
  if (canPlayOpus()) audioCodecs.push("opus");

  const nativeVideoStr = nativeVideoCodecs.join(",");
  const nativeAudioStr = nativeAudioCodecs.join(",");
  const audioCodecStr = audioCodecs.join(",");

  // ── Direct play profiles ──
  // ONLY list containers the browser can play natively via <video src>.
  const directPlayProfiles: DirectPlayProfile[] = [];
  if (nativeVideoCodecs.length > 0) {
    directPlayProfiles.push(
      { Container: "mp4,m4v", Type: "Video", VideoCodec: nativeVideoStr, AudioCodec: nativeAudioStr },
    );
    // Le MKV, lui, n'est lisible que par Chromium — mais il l'est vraiment :
    // WebM étant du Matroska, le démuxeur est déjà embarqué, et jellyfin-web
    // le déclare depuis sa PR #2289. C'est le gain de démarrage principal :
    // sans cette ligne, tout MKV part en DirectStream, donc en remux HLS
    // produit à la demande par ffmpeg, avec la latence que ça coûte.
    //
    // Le repli est assuré par `useVideoSource` : Chromium ouvre parfois un MKV
    // qu'il ne sait pas démuxer sans émettre la moindre erreur — écran noir
    // figé (jellyfin-web #7651). Trois secondes de silence lèvent alors
    // `mkvUnreliable` et cette entrée disparaît pour le reste de la session.
    if (isChromium() && !options?.mkvUnreliable) {
      directPlayProfiles.push(
        { Container: "mkv", Type: "Video", VideoCodec: nativeVideoStr, AudioCodec: nativeAudioStr },
      );
    }
    if (canPlayContainer("video/webm") && canPlayVp9()) {
      directPlayProfiles.push({ Container: "webm", Type: "Video", VideoCodec: "vp9", AudioCodec: "opus,vorbis" });
    }
  }
  if (nativeAudioCodecs.length > 0) {
    directPlayProfiles.push(
      { Container: "mp3", Type: "Audio" },
      { Container: "aac", Type: "Audio" },
      { Container: "flac", Type: "Audio" },
      { Container: "webma,webm", Type: "Audio" },
    );
  }

  // ── Transcoding profiles ──
  // Le conteneur TS ne transporte légalement que l'AAC et les Dolby ; le fMP4
  // accepte tout ce que le moteur décode.
  const audioTs = ["aac", ...audioCodecs.filter((c) => c === "ac3" || c === "eac3")].join(",");
  const audioFmp4 = audioCodecStr || "aac";

  // fMP4 EN PREMIER quand le HEVC est décodable : c'est le seul conteneur qui
  // permette au serveur de COPIER une vidéo HEVC. Sans lui, le seul profil
  // restant impose du H.264, et la moindre piste audio non décodable — un AC3,
  // un DTS — fait ré-encoder toute l'image pour une raison qui n'a rien de
  // visuel. Il vaut pour les deux chemins de lecture : hls.js lit le fMP4
  // directement par MSE, et AVFoundation l'exige.
  const transcodingProfiles: TranscodingProfile[] = [];
  if (canPlayHevc()) {
    transcodingProfiles.push(hlsFmp4Profile("hevc,h264", audioFmp4));
  }
  // Repli universel : segments TS en H.264, que tout navigateur sait lire.
  transcodingProfiles.push(hlsTsProfile("h264", audioTs));
  transcodingProfiles.push(AUDIO_ONLY_PROFILE);

  // ── Codec profiles (constraints) ──
  const codecProfiles: CodecProfile[] = [
    { Type: "Video", Codec: "h264", Conditions: h264Conditions("51") },
  ];
  // Dès que le HEVC est lisible par L'UN des deux chemins : ces conditions
  // gouvernent aussi bien la copie en transcodage que la lecture directe du
  // MKV (Jellyfin les évalue dans les deux cas, cf. `GetCompatibilityVideoCodec`).
  if (canPlayHevc() || nativeHevc()) {
    codecProfiles.push({
      Type: "Video", Codec: "hevc",
      Conditions: [...CONDITIONS_HEVC, dynamicRangeCondition(supportedDynamicRanges())],
    });
  }
  codecProfiles.push(AUDIO_PROFILE_6_CHANNELS);

  return {
    MaxStreamingBitrate: maxBitrate ?? 150_000_000,
    MaxStaticBitrate: 150_000_000,
    MusicStreamingTranscodingBitrate: MUSIC_BITRATE,
    DirectPlayProfiles: directPlayProfiles,
    TranscodingProfiles: transcodingProfiles,
    CodecProfiles: codecProfiles,
    SubtitleProfiles: [...TEXT_SUBTITLES, ...bitmapSubtitles(options?.pgsClientUnavailable)],
  };
}
