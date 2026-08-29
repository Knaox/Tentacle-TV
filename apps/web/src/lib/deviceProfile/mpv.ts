import type { DeviceProfile } from "@tentacle-tv/shared";
import {
  MUSIC_BITRATE, AUDIO_ONLY_PROFILE, hlsTsProfile, BITMAP_SUBTITLES, TEXT_SUBTITLES,
} from "./blocks";

/**
 * Profil de périphérique du lecteur NATIF — celui de mpv, pas d'un navigateur.
 *
 * # Pourquoi il fallait le sien
 *
 * L'application de bureau réclamait à Jellyfin un profil construit en
 * interrogeant `MediaSource.isTypeSupported` et `canPlayType` — les capacités
 * de Chromium — alors que c'est **mpv** qui lit. Or ce profil n'autorise la
 * lecture directe que pour `mp4,m4v`, aucun navigateur ne sachant ouvrir un
 * MKV. Tout MKV partait donc en DirectStream : un remux HLS produit à la volée
 * par ffmpeg côté serveur.
 *
 * Ce remux coûte peu de CPU, mais il change la nature du flux. Les segments
 * sont écrits À LA DEMANDE : mpv ne peut pas prendre trente secondes d'avance
 * sur des fichiers qui n'existent pas encore, sa réserve reste donc mince quel
 * que soit son cache — et une reprise en cours de film demande d'abord à
 * ffmpeg de se positionner, puis de produire ses premiers segments. D'où une
 * image qui part sur presque rien, et une coupure aussitôt après.
 *
 * Le défaut ne se voyait que sur les contenus lourds et HDR, ce qui a longtemps
 * égaré : ce n'est pas le HDR, c'est que ces fichiers-là sont des MKV, quand un
 * film léger est souvent un MP4 déjà lisible en direct.
 *
 * # Ce qu'on déclare
 *
 * Ce que mpv sait réellement ouvrir, c'est-à-dire ce que ffmpeg décode — donc
 * en pratique tout. Aucune `CodecProfiles` : les limites de niveau et de trames
 * de référence décrivent des décodeurs matériels de navigateur, mpv retombe sur
 * son décodeur logiciel là où le matériel ne suit pas.
 */

/** Conteneurs. `mkv` en tête : c'est lui qui manquait. */
const CONTAINERS =
  "mkv,mp4,m4v,mov,avi,ts,m2ts,mts,mpegts,webm,ogv,flv,wmv,asf,mpg,mpeg,3gp,vob,divx";

const VIDEO_CODECS =
  "h264,hevc,av1,vp8,vp9,mpeg2video,mpeg4,msmpeg4v3,vc1,theora,dvvideo,prores";

/** TrueHD, DTS-HD et PCM Blu-ray compris — mpv les décode, le navigateur non. */
const AUDIO_CODECS =
  "aac,ac3,eac3,dts,dca,truehd,mlp,flac,alac,mp3,mp2,opus,vorbis," +
  "pcm,pcm_s16le,pcm_s24le,pcm_bluray,pcm_dvd,wmav2,wmapro";

export function buildMpvDeviceProfile(maxBitrate?: number): DeviceProfile {
  return {
    // Au-delà de tout format physique existant (un Blu-ray UHD plafonne vers
    // 128 Mb/s vidéo) : ce plafond ne doit jamais déclencher un transcodage à
    // lui seul. Le bridage volontaire passe par le sélecteur de qualité, qui
    // fournit alors `maxBitrate`.
    MaxStreamingBitrate: maxBitrate ?? 400_000_000,
    MaxStaticBitrate: 400_000_000,
    MusicStreamingTranscodingBitrate: MUSIC_BITRATE,
    DirectPlayProfiles: [
      { Container: CONTAINERS, Type: "Video", VideoCodec: VIDEO_CODECS, AudioCodec: AUDIO_CODECS },
      { Container: "mp3", Type: "Audio" },
      { Container: "aac,m4a,m4b", Type: "Audio" },
      { Container: "flac", Type: "Audio" },
      { Container: "alac", Type: "Audio" },
      { Container: "ogg,oga,opus", Type: "Audio" },
      { Container: "wav", Type: "Audio" },
    ],
    // Repli : Jellyfin n'y vient que si la lecture directe est écartée — un
    // débit bridé par le sélecteur de qualité, ou un sous-titre bitmap à
    // incruster. `hevc` autorisé, mpv le lit aussi bien que h264.
    TranscodingProfiles: [
      hlsTsProfile("hevc,h264", "aac,ac3,eac3"),
      AUDIO_ONLY_PROFILE,
    ],
    CodecProfiles: [],
    // Inchangés par rapport au profil navigateur : le rendu des sous-titres a
    // sa propre logique côté application (incrustation serveur pour les
    // bitmaps, pistes natives pour le reste), et ce n'est pas le sujet ici.
    SubtitleProfiles: [...TEXT_SUBTITLES, ...BITMAP_SUBTITLES],
  };
}
