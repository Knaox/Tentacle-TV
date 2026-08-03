import type { DeviceProfile, DirectPlayProfile, TranscodingProfile, CodecProfile } from "@tentacle-tv/shared";
import {
  conditionPlageDynamique, CONDITIONS_HEVC, conditionsH264, DEBIT_MUSIQUE,
  PROFIL_AUDIO_6_CANAUX, PROFIL_AUDIO_SEUL,
  profilHlsFmp4, profilHlsTs, sousTitresBitmap, SOUS_TITRES_TEXTE, type OptionsProfilWeb,
} from "./blocs";
import {
  canPlayAac, canPlayAc3, canPlayAv1, canPlayContainer, canPlayEac3, canPlayFlac,
  canPlayH264, canPlayHevc, canPlayMp3, canPlayOpus, canPlayVp9, estChromium,
  natifAac, natifAc3, natifAv1, natifEac3, natifFlac, natifH264, natifHevc,
  natifMp3, natifOpus, natifVp9,
  plagesDynamiquesSupportees,
} from "./codecs";

/**
 * ⚠️ INTERRUPTEUR DE DIAGNOSTIC — TEMPORAIRE, à retirer dès la cause trouvée.
 *
 * Un fichier reste ré-encodé (`hevc_qsv`) alors que Jellyfin ne déclare qu'une
 * raison AUDIO (`TranscodeReasons=AudioCodecNotSupported`) et que toutes les
 * gardes de `EncodingHelper.CanStreamCopyVideo`, relues sur `release-10.11.z`
 * et confrontées à l'URL réellement émise, passent. Le tone mapping a été
 * écarté par un A/B serveur : coupé, l'image est encore recompressée.
 *
 * La déduction est donc épuisée ; il reste la bissection. Ce commutateur
 * retire NOTRE contribution au profil, morceau par morceau, pour voir laquelle
 * débloque la copie. Il se pose depuis la console et vaut pour la session :
 *
 *   localStorage.setItem("tentacle_diag_profil", "calque-jf")    // calque de jellyfin-web
 *   localStorage.setItem("tentacle_diag_profil", "canaux-2")     // 2 canaux (mesuré sans effet)
 *   localStorage.setItem("tentacle_diag_profil", "sans-plage")   // sans VideoRangeType
 *   localStorage.setItem("tentacle_diag_profil", "sans-hevc")    // sans le profil HEVC entier
 *   localStorage.setItem("tentacle_diag_profil", "sans-audio6")  // sans la limite 6 canaux
 *   localStorage.removeItem("tentacle_diag_profil")              // profil normal
 *
 * Déjà éliminés par la mesure ou par le code de Jellyfin 10.11 : le HDR et le
 * tone mapping, la plage dynamique, les contraintes HEVC, le nombre de canaux
 * audio, `BreakOnNonKeyFrames` (il ne pilote que `-noaccurate_seek`) et
 * `CopyTimestamps` (il ne pilote que le PTS des sous-titres).
 *
 * Rien d'autre ne doit bouger entre deux essais : c'est une comparaison.
 */
export function diagnosticProfil(): string | null {
  try { return localStorage.getItem("tentacle_diag_profil"); } catch { return null; }
}

export function buildBrowserDeviceProfile(
  maxBitrate?: number,
  options?: OptionsProfilWeb,
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
  const videoNatifs: string[] = [];
  if (natifH264()) videoNatifs.push("h264");
  if (natifHevc()) videoNatifs.push("hevc");
  if (natifVp9())  videoNatifs.push("vp9");
  if (natifAv1())  videoNatifs.push("av1");

  const audioNatifs: string[] = [];
  if (natifAac())  audioNatifs.push("aac");
  if (natifMp3())  audioNatifs.push("mp3");
  if (natifAc3())  audioNatifs.push("ac3");
  if (natifEac3()) audioNatifs.push("eac3");
  if (natifFlac()) audioNatifs.push("flac");
  if (natifOpus()) audioNatifs.push("opus");

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

  const videoNatifStr = videoNatifs.join(",");
  const audioNatifStr = audioNatifs.join(",");
  const audioCodecStr = audioCodecs.join(",");

  // ── Direct play profiles ──
  // ONLY list containers the browser can play natively via <video src>.
  const directPlayProfiles: DirectPlayProfile[] = [];
  if (videoNatifs.length > 0) {
    directPlayProfiles.push(
      { Container: "mp4,m4v", Type: "Video", VideoCodec: videoNatifStr, AudioCodec: audioNatifStr },
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
    // `mkvNonFiable` et cette entrée disparaît pour le reste de la session.
    if (estChromium() && !options?.mkvNonFiable) {
      directPlayProfiles.push(
        { Container: "mkv", Type: "Video", VideoCodec: videoNatifStr, AudioCodec: audioNatifStr },
      );
    }
    if (canPlayContainer("video/webm") && canPlayVp9()) {
      directPlayProfiles.push({ Container: "webm", Type: "Video", VideoCodec: "vp9", AudioCodec: "opus,vorbis" });
    }
  }
  if (audioNatifs.length > 0) {
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
    transcodingProfiles.push(profilHlsFmp4("hevc,h264", audioFmp4));
  }
  // Repli universel : segments TS en H.264, que tout navigateur sait lire.
  transcodingProfiles.push(profilHlsTs("h264", audioTs));
  transcodingProfiles.push(PROFIL_AUDIO_SEUL);

  // Diagnostic « canaux-2 » : ramène la demande à 2 canaux. MESURÉ SANS EFFET —
  // les arguments audio de ffmpeg deviennent identiques à ceux de jellyfin-web
  // (`-ac 2 -ab 256000 -af volume=2`) et l'image reste recompressée.
  if (diagnosticProfil() === "canaux-2") {
    for (let i = 0; i < transcodingProfiles.length; i++) {
      transcodingProfiles[i] = { ...transcodingProfiles[i], MaxAudioChannels: "2" };
    }
  }
  // Diagnostic « calque-jf » : le profil de transcodage de jellyfin-web, aux
  // valeurs relevées dans SON URL de transcodage sur ce fichier — plus une
  // reconstitution à l'aveugle, un calque.
  //
  //   VideoCodec=av1,hevc,h264,vp9   AudioCodec=aac,opus,flac
  //   TranscodingMaxAudioChannels=2  MinSegments=1
  //   BreakOnNonKeyFrames=False      (pas de CopyTimestamps)
  if (diagnosticProfil() === "calque-jf") {
    transcodingProfiles.length = 0;
    transcodingProfiles.push({
      Container: "mp4", Type: "Video",
      VideoCodec: "av1,hevc,h264,vp9", AudioCodec: "aac,opus,flac",
      Protocol: "hls", Context: "Streaming",
      MaxAudioChannels: "2", MinSegments: 1, BreakOnNonKeyFrames: false,
    });
  }

  // ── Codec profiles (constraints) ──
  const codecProfiles: CodecProfile[] = [
    { Type: "Video", Codec: "h264", Conditions: conditionsH264("51") },
  ];
  // Dès que le HEVC est lisible par L'UN des deux chemins : ces conditions
  // gouvernent aussi bien la copie en transcodage que la lecture directe du
  // MKV (Jellyfin les évalue dans les deux cas, cf. `GetCompatibilityVideoCodec`).
  const diag = diagnosticProfil();
  if ((canPlayHevc() || natifHevc()) && diag !== "sans-hevc") {
    codecProfiles.push({
      Type: "Video", Codec: "hevc",
      Conditions: diag === "sans-plage"
        ? [...CONDITIONS_HEVC]
        : [...CONDITIONS_HEVC, conditionPlageDynamique(plagesDynamiquesSupportees())],
    });
  }
  if (diag === "canaux-2") {
    codecProfiles.push({
      Type: "VideoAudio",
      Conditions: [{ Condition: "LessThanEqual", Property: "AudioChannels", Value: "2", IsRequired: false }],
    });
  } else if (diag !== "sans-audio6" && diag !== "calque-jf") {
    codecProfiles.push(PROFIL_AUDIO_6_CANAUX);
  }
  // Le calque de jellyfin-web ne garde qu'UNE contrainte : la plage dynamique,
  // et SANS les variantes Dolby Vision — c'est elle qui, paradoxalement, lui
  // vaut la copie. En ne déclarant pas `DOVIWithHDR10Plus`, il fait entrer
  // Jellyfin dans la branche « retirer les métadonnées HDR dynamiques » de
  // `CanStreamCopyVideo` ; ffmpeg sait strip le RPU Dolby Vision, donc la copie
  // est autorisée. Nous, en la déclarant, nous sautons cette branche.
  if (diag === "calque-jf") {
    codecProfiles.length = 0;
    codecProfiles.push({
      Type: "Video", Codec: "hevc",
      Conditions: [conditionPlageDynamique(["SDR", "HDR10", "HDR10Plus", "HLG"])],
    });
  }

  return {
    MaxStreamingBitrate: maxBitrate ?? 150_000_000,
    MaxStaticBitrate: 150_000_000,
    MusicStreamingTranscodingBitrate: DEBIT_MUSIQUE,
    DirectPlayProfiles: directPlayProfiles,
    TranscodingProfiles: transcodingProfiles,
    CodecProfiles: codecProfiles,
    SubtitleProfiles: [...SOUS_TITRES_TEXTE, ...sousTitresBitmap(options?.pgsClientIndisponible)],
  };
}
