import type {
  DeviceProfile,
  DirectPlayProfile,
  TranscodingProfile,
  CodecProfile,
} from "@tentacle-tv/shared";
import {
  conditionPlageDynamique,
  CONDITIONS_HEVC,
  conditionsH264,
  DEBIT_MUSIQUE,
  PROFIL_AUDIO_6_CANAUX,
  PROFIL_AUDIO_SEUL,
  profilHlsFmp4,
  profilHlsTs,
  sousTitresBitmap,
  SOUS_TITRES_TEXTE,
  type OptionsProfilWeb,
} from "@/lib/deviceProfile/blocs";
import { capacitesTeleviseur } from "../amorce/webosGlobals";
import { CONTENEURS_TV, sonderCodecs, plagesDynamiquesTv } from "./codecsWebos";

/**
 * Profil d'appareil d'un téléviseur LG.
 *
 * Substitué à `buildBrowserDeviceProfile` par la configuration de build, et
 * non ajouté à côté : `construireProfil` de `usePlaybackInfo` reste tel quel,
 * et le lecteur n'a aucune condition de plateforme à porter.
 *
 * Trois choses le distinguent du profil d'un navigateur.
 *
 * **Un seul chemin de décodage.** hls.js est évincé du bundle : tout passe par
 * `<video src>`, donc par la puce de la dalle. Il n'y a plus lieu de tenir
 * deux listes de codecs — celle de MSE ne décrirait rien de ce qui sera
 * réellement lu. C'est aussi ce qui rend le direct play si intéressant ici :
 * le décodeur matériel ouvre le HEVC 10 bits, le Dolby Vision et le TrueHD
 * qu'aucun navigateur de bureau ne touche.
 *
 * **Les capacités viennent de la dalle**, pas d'une sonde de codec. Une puce
 * peut décoder du HEVC 4K tout en étant montée derrière un écran 1080p, et
 * `canPlayType` n'en dira rien. `deviceInfo` le dit.
 *
 * **Le DTS se sonde**, il ne se suppose pas : son support varie d'un modèle à
 * l'autre au sein d'une même version de webOS, selon les licences que LG a
 * payées pour ce marché-là.
 */
export function buildBrowserDeviceProfile(
  maxBitrate?: number,
  options?: OptionsProfilWeb,
): DeviceProfile {
  const dalle = capacitesTeleviseur();
  const codecs = sonderCodecs();

  const video = codecs.video.join(",");
  const audio = codecs.audio.join(",");

  // ── Lecture directe ──
  //
  // Les conteneurs sont ceux que le démultiplexeur de webOS ouvre, MKV compris
  // — et c'est le gain principal. Sur un navigateur, un MKV part en remux HLS
  // produit à la demande par ffmpeg ; ici il est lu tel quel.
  const directPlayProfiles: DirectPlayProfile[] = [];
  if (codecs.video.length > 0) {
    for (const conteneur of CONTENEURS_TV) {
      directPlayProfiles.push({
        Container: conteneur,
        Type: "Video",
        VideoCodec: video,
        AudioCodec: audio,
      });
    }
  }
  if (codecs.audio.length > 0) {
    directPlayProfiles.push(
      { Container: "mp3", Type: "Audio" },
      { Container: "aac", Type: "Audio" },
      { Container: "flac", Type: "Audio" },
      { Container: "webma,webm", Type: "Audio" },
    );
  }

  // ── Transcodage ──
  //
  // Repli seulement : tout ce qui arrive ici est un fichier que la dalle n'a
  // pas su ouvrir. Le fMP4 en premier quand le HEVC est décodé, parce que
  // c'est le seul conteneur qui permette au serveur de COPIER l'image — sans
  // lui, une piste audio exotique suffirait à faire ré-encoder une vidéo 4K
  // pour une raison qui n'a rien de visuel.
  const transcodingProfiles: TranscodingProfile[] = [];
  if (codecs.video.includes("hevc")) {
    transcodingProfiles.push(profilHlsFmp4("hevc,h264", audio || "aac"));
  }
  transcodingProfiles.push(profilHlsTs("h264", audioPourTs(codecs.audio)));
  transcodingProfiles.push(PROFIL_AUDIO_SEUL);

  // ── Contraintes ──
  const codecProfiles: CodecProfile[] = [
    { Type: "Video", Codec: "h264", Conditions: conditionsH264(niveauH264(dalle.uhd)) },
  ];
  if (codecs.video.includes("hevc")) {
    codecProfiles.push({
      Type: "Video",
      Codec: "hevc",
      Conditions: [...CONDITIONS_HEVC, conditionPlageDynamique(plagesDynamiquesTv(dalle, codecs))],
    });
  }
  codecProfiles.push(PROFIL_AUDIO_6_CANAUX);

  return {
    MaxStreamingBitrate: maxBitrate ?? plafondDebit(dalle.uhd),
    MaxStaticBitrate: plafondDebit(dalle.uhd),
    MusicStreamingTranscodingBitrate: DEBIT_MUSIQUE,
    DirectPlayProfiles: directPlayProfiles,
    TranscodingProfiles: transcodingProfiles,
    CodecProfiles: codecProfiles,
    SubtitleProfiles: [...SOUS_TITRES_TEXTE, ...sousTitresBitmap(options?.pgsClientIndisponible)],
  };
}

/** Le conteneur TS ne transporte légalement que l'AAC et les Dolby. */
function audioPourTs(disponibles: string[]): string {
  return ["aac", ...disponibles.filter((codec) => codec === "ac3" || codec === "eac3")].join(",");
}

/**
 * Niveau H.264 maximal.
 *
 * 5.1 pour une dalle 4K, 4.2 sinon. Déclarer un niveau que le décodeur ne tient
 * pas ne provoque pas un repli propre : la lecture démarre puis saccade, ce
 * qu'aucun mécanisme ne rattrape en cours de route.
 */
function niveauH264(uhd: boolean | undefined): string {
  return uhd ? "51" : "42";
}

/**
 * Plafond de débit.
 *
 * Ce sont des enveloppes de sécurité, pas des cibles : ~50 Mb/s couvre un
 * HEVC 4K60 au niveau 5.1, ~20 Mb/s un 1080p60 au niveau 4.1. Aucun plafond
 * implicite plus bas n'est posé — c'est le piège classique qui fait transcoder
 * des fichiers que la dalle aurait lus sans effort.
 */
function plafondDebit(uhd: boolean | undefined): number {
  return uhd ? 50_000_000 : 20_000_000;
}
