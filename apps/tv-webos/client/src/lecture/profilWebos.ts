import type {
  DeviceProfile,
  DirectPlayProfile,
  CodecProfile,
} from "@tentacle-tv/shared";
import {
  conditionPlageDynamique,
  CONDITIONS_HEVC,
  conditionsH264,
  DEBIT_MUSIQUE,
  sousTitresBitmap,
  SOUS_TITRES_TEXTE,
  type OptionsProfilWeb,
} from "@/lib/deviceProfile/blocs";
import { CONTENEURS_DOVI, plafondDebit } from "./capacitesWebos";
import { plagesDynamiquesTv, resoudreProfil, type ProfilResolu } from "./codecsWebos";
import {
  codecsRetenus,
  conteneurRetenu,
  memoireReplis,
  type MemoireReplis,
} from "./repliLecture";
import { transcodage } from "./remuxWebos";

/**
 * Profil d'appareil d'un téléviseur LG.
 *
 * Substitué à `buildBrowserDeviceProfile` par la configuration de build, et non
 * ajouté à côté : `construireProfil` de `usePlaybackInfo` reste tel quel, et le
 * lecteur n'a aucune condition de plateforme à porter.
 *
 * Quatre choses le distinguent du profil d'un navigateur.
 *
 * **Un seul chemin de décodage.** hls.js est évincé du bundle : tout passe par
 * `<video src>`, donc par la puce de la dalle. C'est ce qui rend la lecture
 * directe si intéressante ici — le décodeur matériel ouvre le HEVC 10 bits, le
 * Dolby Vision et le MKV qu'aucun navigateur de bureau ne touche.
 *
 * **Les capacités viennent d'une table documentée**, pas d'une sonde de codec
 * (cf. `codecsWebos.ts`, qui explique pourquoi `canPlayType` ment ici).
 *
 * **Aucune limite de canaux sur l'audio d'une vidéo.** Le `CodecProfile`
 * `VideoAudio` du profil navigateur plafonnait toutes les pistes à six canaux :
 * un 7.1 partait donc en transcodage. Le retirer est ce qui donne son
 * passthrough à ce profil — et c'est, à la lettre, ce qui distingue Moonfin de
 * `jellyfin-web` sur ce point.
 *
 * **Un plancher.** Quoi qu'il arrive — table vide, session qui a tout
 * disqualifié — il reste une entrée de lecture directe. L'ancien profil pouvait
 * n'en produire aucune, et tout partait alors en transcodage.
 */
export function buildBrowserDeviceProfile(
  maxBitrate?: number,
  options?: OptionsProfilWeb,
): DeviceProfile {
  return construireProfilTv(resoudreProfil(), memoireReplis(), maxBitrate, options);
}

/**
 * L'assemblage proprement dit, séparé de la lecture des globales.
 *
 * Ce que ce profil décide ne se voit qu'à l'usage, sur une dalle, des mois plus
 * tard — un fichier qui transcode sans raison ne se signale pas. La seule façon
 * de le tenir est de pouvoir l'interroger depuis un test, donc de lui passer les
 * capacités au lieu de les lire dans `window`.
 */
export function construireProfilTv(
  resolu: ProfilResolu,
  memoireBrute: MemoireReplis,
  maxBitrate?: number,
  options?: OptionsProfilWeb,
): DeviceProfile {
  const memoire = memoireAvecOptions(memoireBrute, options);
  const plafond = plafondDebit(resolu.dalle.uhd, resolu.dalle.uhd8K);

  return {
    MaxStreamingBitrate: maxBitrate ?? plafond,
    MaxStaticBitrate: plafond,
    MusicStreamingTranscodingBitrate: DEBIT_MUSIQUE,
    // Un palier de qualité choisi (maxBitrate défini — usePlaybackInfo ne rebâtit
    // le profil que dans ce cas) doit être EFFECTIF : avec des entrées de lecture
    // directe, Jellyfin garde le fichier tel quel dès qu'il ne sait pas comparer
    // son débit au plafond — « choisir 720p ne change rien ». On force donc le
    // chemin transcode, comme le profil tvOS le fait déjà (buildTvosDeviceProfile).
    DirectPlayProfiles: maxBitrate != null ? [] : lectureDirecte(resolu, memoire),
    TranscodingProfiles: transcodage(resolu, memoire, options?.sourceDolbyVision),
    CodecProfiles: contraintes(resolu),
    SubtitleProfiles: [
      ...SOUS_TITRES_TEXTE,
      // Sans WebAssembly, le décodeur PGS du client n'existe pas : la seule
      // façon d'afficher un sous-titre image est de le faire incruster par le
      // serveur, au prix d'un ré-encodage. C'est un dernier recours assumé, et
      // l'interface le signale (`player.sousTitresIncrustes`).
      ...sousTitresBitmap(options?.pgsClientIndisponible || !resolu.capacites.wasmDisponible),
    ],
  };
}

/**
 * Le drapeau `mkvNonFiable` d'`usePlaybackInfo` rejoint la mémoire des replis.
 *
 * Les deux mécanismes disent la même chose — « ce conteneur n'a rien donné,
 * n'insiste pas » — et le client web tient le sien depuis plus longtemps. Les
 * fusionner ici évite d'avoir deux vérités sur le même sujet.
 */
function memoireAvecOptions(memoire: MemoireReplis, options?: OptionsProfilWeb): MemoireReplis {
  if (!options?.mkvNonFiable) return memoire;
  if (memoire.conteneurs.indexOf("mkv") !== -1) return memoire;
  return { ...memoire, conteneurs: [...memoire.conteneurs, "mkv"] };
}

/**
 * Lecture directe : le fichier tel qu'il est sur le disque du serveur.
 *
 * Une entrée par conteneur, et non une entrée fourre-tout : le démultiplexeur de
 * webOS n'accepte pas les mêmes codecs partout — l'AV1 passe en MP4 et en MKV,
 * jamais en flux de transport. Une liste unique promettrait des combinaisons qui
 * n'existent pas, et chacune se paie d'un échec à l'ouverture.
 */
function lectureDirecte(resolu: ProfilResolu, memoire: MemoireReplis): DirectPlayProfile[] {
  const profils: DirectPlayProfile[] = [];

  for (const conteneur of resolu.capacites.conteneurs) {
    if (!conteneurRetenu(memoire, conteneur.nom)) continue;
    const video = codecsRetenus(memoire.video, conteneur.video);
    const audio = codecsRetenus(memoire.audio, conteneur.audio);
    if (video.length === 0 || audio.length === 0) continue;
    profils.push({
      Container: conteneur.nom,
      Type: "Video",
      VideoCodec: video.join(","),
      AudioCodec: audio.join(","),
    });
  }

  // Le plancher. Un profil sans la moindre entrée vidéo fait transcoder toute
  // une médiathèque — c'est ce que produisait l'ancienne sonde quand le moteur
  // répondait "". Le H.264 en MP4 avec de l'AAC est le seul couple qu'aucun
  // téléviseur LG n'ait jamais refusé.
  if (!profils.some((profil) => profil.Type === "Video")) {
    profils.push({ Container: "mp4,m4v", Type: "Video", VideoCodec: "h264", AudioCodec: "aac" });
  }

  for (const conteneur of resolu.capacites.conteneursAudio) {
    profils.push({ Container: conteneur, Type: "Audio" });
  }

  return profils;
}

/**
 * Contraintes de codec.
 *
 * Volontairement peu nombreuses : chacune est un prétexte de plus offert au
 * serveur pour recompresser. Il n'y a ici que ce qui décrit une limite réelle du
 * décodeur — le niveau H.264 et HEVC — et la condition de plage dynamique, la
 * seule qui protège du tone mapping.
 *
 * **Aucun `CodecProfile` de type `VideoAudio`**, et c'est délibéré : c'est lui
 * qui plafonne le nombre de canaux de la piste audio d'une vidéo. Son absence
 * est ce qui laisse passer un TrueHD 7.1 ou un E-AC3 Atmos sans downmix serveur.
 */
function contraintes(resolu: ProfilResolu): CodecProfile[] {
  const profils: CodecProfile[] = [
    // 5.1 pour une dalle 4K, 4.2 sinon. Déclarer un niveau que le décodeur ne
    // tient pas ne provoque pas un repli propre : la lecture démarre puis
    // saccade, ce qu'aucun mécanisme ne rattrape en cours de route.
    { Type: "Video", Codec: "h264", Conditions: conditionsH264(resolu.dalle.uhd ? "51" : "42") },
    {
      Type: "Video",
      Codec: "hevc",
      Conditions: [
        ...CONDITIONS_HEVC,
        conditionPlageDynamique(plagesDynamiquesTv(resolu.dalle)),
      ],
    },
  ];

  /**
   * Le Dolby Vision hors des conteneurs qui le portent.
   *
   * C'est une limite du démultiplexeur et non du décodeur : la puce lit le
   * Dolby Vision, mais webOS ne lui transmet le RPU qu'en ISOBMFF et en flux de
   * transport (`CONTENEURS_DOVI`) — jamais en MKV avant webOS 25. Or **une
   * médiathèque est faite de MKV** : sur celle qui a servi de banc d'essai, 353
   * des 983 fichiers 4K sont en Dolby Vision, tous en MKV.
   *
   * Ce profil ne retire donc, de ces conteneurs-là, que le seul `DOVI` nu —
   * c'est-à-dire le profil 5. **On ne remuxe plus que ce qui l'exige.**
   *
   * L'arbitrage a changé, et il vaut d'être expliqué. Le profil retirait
   * autrefois TOUTES les plages Dolby Vision : Jellyfin ne pouvait plus faire de
   * lecture directe, il remuxait en fMP4, et le RPU passait. Mesuré sur une C3,
   * même fichier :
   *
   *     lecture directe du MKV   hdrType « HDR10 »        (la couche de base)
   *     remux HLS en fMP4        hdrType « DolbyVision »  (le RPU passe)
   *
   * On y gagnait le Dolby Vision. On y perdait une session ffmpeg par lecture,
   * une playlist de 1,7 Mo — et surtout le défaut de segmentation du serveur,
   * qui annonce des frontières que ffmpeg n'honore pas : mesuré deux fois, le
   * téléviseur finissait par ne plus pouvoir raccorder un fragment, redemandait
   * ses voisins des milliers de fois et n'en repartait plus.
   *
   * Les profils 8.x portent une couche de base HDR10, HLG ou SDR qu'un décodeur
   * ignorant le RPU affiche juste et complète : ils repartent en lecture directe,
   * sans serveur. Le profil 5 n'a pas ce filet — sa couche de base est en
   * IPT-PQ-C2, verdâtre — et reste donc remuxé, parce que là c'est nécessaire.
   *
   * **La liste est négative** (`-mp4,…`), et c'est ce qui la rend juste sur les
   * gammes à venir : un conteneur inconnu est traité comme ne portant pas le
   * RPU, donc son profil 5 est remuxé, ce qui est toujours le comportement sûr.
   *
   * Un second profil plutôt qu'un retrait global : les conditions de tous les
   * profils qui correspondent doivent être satisfaites, donc un MKV Dolby
   * Vision échoue sur celui-ci pendant qu'un MP4 ne le rencontre jamais.
   *
   * La garde est ce qui fait dépendre le comportement du MODÈLE : sur webOS 25,
   * `doviEnMkv` est vrai et ce profil disparaît — le MKV repart en lecture
   * directe, sans aucune session serveur. Sans Dolby Vision sur la dalle, il
   * n'aurait pas d'objet : le profil général n'y déclare déjà pas `DOVI`.
   */
  if (resolu.dalle.dolbyVision && !resolu.capacites.doviEnMkv) {
    profils.push({
      Type: "Video",
      Codec: "hevc",
      Container: `-${CONTENEURS_DOVI}`,
      Conditions: [conditionPlageDynamique(plagesDynamiquesTv(resolu.dalle, true))],
    });
  }

  return profils;
}
