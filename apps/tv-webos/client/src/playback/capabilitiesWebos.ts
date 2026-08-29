import type { GenerationWebos } from "./generationWebos";

/**
 * Ce qu'un téléviseur LG sait décoder, par génération et par conteneur.
 *
 * La table vient de la documentation LG « Audio and Video Format on webOS TV »,
 * qui est publiée conteneur par conteneur — et c'est précisément la maille qui
 * compte : le HEVC passe en MP4, MKV et TS mais pas en AVI, l'AV1 passe en MP4
 * et MKV mais **jamais** en TS. Une liste plate de codecs, comme en tiennent la
 * plupart des clients, promet des combinaisons qui n'existent pas.
 *
 * Deux avertissements, tous deux payés par un écran noir chez quelqu'un.
 *
 * **La documentation LG est normative pour ce qu'elle liste, pas pour ce qu'elle
 * a oublié de retirer.** Les pages 5.0, 6.0 et 22 mentionnent toujours le DTS en
 * MKV alors que LG avait retiré le décodeur du matériel. D'où les correctifs
 * matériels ci-dessous, qui priment sur la table.
 *
 * **Ce qui n'est jamais listé n'existe pas.** TrueHD, ALAC, le FLAC dans un MKV
 * et le conteneur WebM ne figurent dans aucune page, aucune génération. Les
 * déclarer donnerait une piste muette — pire qu'un transcodage audio.
 */

/** Un conteneur et ce qu'il peut porter, du point de vue du démultiplexeur LG. */
export interface ContainerTv {
  /** Nom Jellyfin ; plusieurs extensions se déclarent d'un coup. */
  nom: string;
  video: string[];
  audio: string[];
}

export interface HardwareTv {
  /** Année du modèle, `null` si `modelName` n'a pas pu être décodé. */
  year: number | null;
  /** `deviceInfo.oled` — départage les gammes 2023-2024 pour le DTS. */
  oled: boolean;
  /** `deviceInfo.uhd8K` — débloque l'AV1 avant 2023 (modèles 8K seuls). */
  uhd8K: boolean;
}

export interface CapabilityFlagsTv {
  containers: ContainerTv[];
  /** Conteneurs audio purs, où le FLAC est autorisé — et seulement là. */
  audioContainers: string[];
  /**
   * WebAssembly est-il là ? Absent avant Chromium 57, donc avant webOS 5.
   *
   * Ce n'est pas une question de confort. Le décodeur de sous-titres image du
   * client — celui qui dessine le PGS sur un canvas — est compilé en
   * WebAssembly. Sans lui, la seule façon d'afficher un PGS est de demander au
   * serveur de l'incruster, c'est-à-dire de RECOMPRESSER l'image entière. Cette
   * ligne décide donc, à elle seule, si un sous-titre image peut coûter un
   * transcodage vidéo sur cette génération.
   */
  wasmAvailable: boolean;
  /** Dolby Vision dans un MKV : débloqué par LG à partir de webOS 25. */
  doviEnMkv: boolean;
}

/**
 * Les seuls conteneurs où webOS démultiplexe le RPU Dolby Vision.
 *
 * Réponse d'un ingénieur LG sur le forum développeur : le lecteur média accepte
 * le Dolby Vision « en MPEG-2 TS et en ISOBMFF », le premier via un descripteur
 * dans le PMT, le second via la boîte `dvcC` du sample entry. **Le MKV n'y est
 * pas**, et la question, reposée depuis, est restée sans réponse — jusqu'à
 * webOS 25, qui l'ajoute (`doviEnMkv`).
 *
 * Cette liste sert en NÉGATIF (`profilWebos.ts → constraints()`) : partout
 * ailleurs, les plages Dolby Vision sont retirées pour que Jellyfin remuxe vers
 * un conteneur qui, lui, porte les métadonnées.
 */
export const DOVI_CONTAINERS = "mp4,m4v,mov,ts,m2ts,mts,mpegts";

/**
 * Ce que webOS ne démultiplexe JAMAIS, quels que soient le conteneur, la
 * génération et le matériel.
 *
 * C'est la contrepartie exécutable de l'avertissement d'en-tête — « ce qui
 * n'est jamais listé n'existe pas ». Le profil d'appareil s'en sert par
 * omission, en ne déclarant pas ces codecs ; `publishableTracksTv.ts` s'en sert
 * en affirmation, pour savoir d'avance qu'une piste n'apparaîtra pas dans
 * `video.audioTracks` et qu'il faudra la demander au serveur.
 *
 * Une barre de son ne change rien à cette liste, et c'est contre-intuitif : le
 * blocage n'est pas à la SORTIE mais au démultiplexage. La piste n'est jamais
 * extraite du fichier, donc elle n'atteint jamais l'eARC.
 *
 * **Le DTS n'y est pas, délibérément.** Il dépend de l'année du modèle
 * (`dtsSupported`), c'est-à-dire d'un « peut-être », et un peut-être se tranche
 * à l'exécution en regardant ce que le lecteur a publié.
 */
export const NEVER_DEMUXED_CODECS = new Set(["truehd", "mlp", "alac"]);

/** Codecs vidéo par conteneur, socle commun à toutes les générations. */
const VIDEO_MP4 = ["h264", "hevc", "mpeg4"];
const VIDEO_MKV = ["h264", "hevc", "mpeg2video", "mpeg4", "vp8", "vp9"];
const VIDEO_TS = ["h264", "hevc", "mpeg2video"];

/**
 * Le PCM se déclare sous ses trois noms.
 *
 * Jellyfin nomme les pistes d'après ffmpeg — `pcm_s16le`, `pcm_s24le` — et un
 * profil qui n'annonce que `pcm` ne correspond à aucune d'elles. `jellyfin-web`
 * pousse les deux variantes pour webOS et Tizen, pour cette raison exactement.
 */
const PCM = ["pcm", "pcm_s16le", "pcm_s24le"];

/** Nom Jellyfin du DTS, sous ses deux orthographes. */
const DTS = ["dts", "dca"];

/**
 * Le DTS, décodé ou non selon l'ANNÉE du modèle — jamais selon la version de
 * webOS.
 *
 * Chronologie réelle, qui n'est pas monotone : LG l'avait, l'a retiré en 2020,
 * l'a réintroduit en 2023 sur une partie de la gamme, l'a retiré à nouveau en
 * 2025. La règle de `jellyfin-web` (`>= 5 && < 23`) date d'avant ce dernier
 * virage et laisserait repasser le DTS sur un téléviseur de 2025.
 *
 * On refuse dès qu'un doute subsiste. Le prix d'un refus est un transcodage
 * **audio**, que ce chantier accepte ; le prix d'une erreur inverse est une
 * piste silencieuse, que personne ne rattrape en cours de lecture.
 */
export function dtsSupported(materiel: HardwareTv): boolean {
  const { year } = materiel;
  if (year === null) return false;
  // Jusqu'en 2017, le décodeur est là sans condition.
  if (year <= 2017) return true;
  // 2018-2019 : LG restreint le DTS « à la lecture par USB et HDMI ». Une
  // application n'est ni l'un ni l'autre.
  if (year <= 2019) return false;
  // 2020-2022 : licence retirée. « For LG TVs released in 2020, the DTS codec
  // is not supported. »
  if (year <= 2022) return false;
  // 2023-2024 : réintroduit, mais « available in specific models only » — les
  // OLED et les QNED haut de gamme. `oled` est le seul de ces deux critères que
  // `deviceInfo` sache nous dire ; un QNED 85 paiera un transcodage audio.
  if (year <= 2024) return materiel.oled;
  // 2025 : retiré à nouveau. 2026 : non confirmé, donc non.
  return false;
}

/**
 * L'AV1, décodé ou non.
 *
 * La documentation LG le liste dès webOS 4.5, mais le service d'assistance
 * corrige : « supported only in 8K models with 8K upgrader connected ». Le
 * décodage 4K ne se généralise qu'avec les modèles 2023. `jellyfin-web`
 * l'active dès webOS 5 — c'est de là que viennent les écrans noirs rapportés
 * sur des dalles de 2020.
 */
export function av1Supported(materiel: HardwareTv): boolean {
  if (materiel.uhd8K) return true;
  return materiel.year !== null && materiel.year >= 2023;
}

/**
 * Codecs audio d'un conteneur vidéo.
 *
 * L'AAC, le MP3 et l'AC3 sont de toutes les générations. L'E-AC3 aussi, à ceci
 * près qu'il n'entre dans le MKV qu'à partir de webOS 4 — la page 3.0 ne le
 * liste que pour le MP4 et le TS.
 */
function audioVideo(
  generation: GenerationWebos,
  materiel: HardwareTv,
  container: "mp4" | "mkv" | "ts",
): string[] {
  const codecs = ["aac", "mp3", "ac3"];
  if (container !== "mkv" || generation >= 4) codecs.push("eac3");
  if (container === "mkv") {
    codecs.push(...PCM);
    // L'Opus en MKV n'apparaît dans la documentation qu'avec webOS 24.
    // `jellyfin-web` l'active dès 3.5, six générations trop tôt.
    if (generation >= 24) codecs.push("opus");
  }
  // Le DTS n'entre en MP4 et en TS qu'avec les gammes 2023, quand LG l'a
  // réintroduit ; en MKV il y a toujours été quand le décodeur existait.
  if (dtsSupported(materiel) && (container === "mkv" || generation >= 23)) {
    codecs.push(...DTS);
  }
  return codecs;
}

/** Ce que la génération et le matériel autorisent, conteneur par conteneur. */
export function capabilitiesOf(
  generation: GenerationWebos,
  materiel: HardwareTv,
): CapabilityFlagsTv {
  const av1 = av1Supported(materiel);

  const containers: ContainerTv[] = [
    {
      nom: "mp4,m4v,mov",
      video: av1 ? [...VIDEO_MP4, "av1"] : VIDEO_MP4,
      audio: audioVideo(generation, materiel, "mp4"),
    },
    {
      nom: "mkv",
      video: av1 ? [...VIDEO_MKV, "av1"] : VIDEO_MKV,
      audio: audioVideo(generation, materiel, "mkv"),
    },
    {
      // L'AV1 et le VP9 ne passent JAMAIS en flux de transport : le
      // démultiplexeur TS de LG ne les connaît pas.
      nom: "ts,m2ts,mts,mpegts",
      video: VIDEO_TS,
      audio: audioVideo(generation, materiel, "ts"),
    },
    {
      nom: "avi",
      video: ["mpeg4", "msmpeg4v3", "h264", "mjpeg"],
      // Le DTS quitte la ligne AVI dès webOS 5, même là où il est décodé
      // ailleurs.
      audio: ["mp3", "ac3", ...PCM],
    },
    {
      nom: "asf,wmv",
      video: ["vc1"],
      audio: ["wmav2"],
    },
    {
      nom: "mpg,mpeg",
      video: ["mpeg1video", "mpeg2video"],
      audio: ["mp3", "ac3", "mp2"],
    },
    {
      nom: "vob",
      video: ["mpeg1video", "mpeg2video"],
      audio: ["ac3", ...PCM],
    },
    {
      nom: "3gp,3g2",
      video: ["h264", "mpeg4"],
      audio: ["aac"],
    },
  ];

  return {
    containers,
    // Le FLAC n'est décodé que comme fichier autonome, sur deux canaux : il
    // n'est listé dans AUCUN conteneur vidéo, aucune génération. Le déclarer
    // dans un MKV rendrait la piste muette.
    audioContainers: ["mp3", "aac,m4a", "flac", "wav", "ogg,oga"],
    wasmAvailable: generation >= 5,
    doviEnMkv: generation >= 25,
  };
}

/**
 * Plafond de débit annoncé à Jellyfin.
 *
 * Ce n'est pas une capacité de décodage mais une enveloppe, et la prudence s'y
 * inverse : un plafond trop bas ne protège de rien, il fait recompresser des
 * fichiers que la dalle aurait lus. C'est le défaut que ce chantier corrige —
 * le profil précédent tombait à 20 Mb/s dès que `deviceInfo` omettait `uhd`,
 * omission que LG produit sur des téléviseurs parfaitement capables.
 *
 * Les valeurs sont donc généreuses, et alignées sur Moonfin. Les vrais plafonds
 * de décodage de LG (60 Mb/s en HEVC 4K, 100 en 8K) ne sont volontairement pas
 * déclarés : les dépasser produit au pire des saccades, que le transcodage ne
 * rattraperait pas mieux.
 */
export function plafondDebit(uhd: boolean, uhd8K: boolean): number {
  if (uhd8K) return 200_000_000;
  return uhd ? 120_000_000 : 80_000_000;
}
