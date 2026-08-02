/**
 * Ce que le serveur a RÉELLEMENT décidé de faire du flux.
 *
 * `SupportsDirectPlay` et `SupportsDirectStream` décrivent ce que le fichier
 * PERMET, pas ce que Jellyfin a choisi : un booléen à vrai coexiste très bien
 * avec une `TranscodingUrl`. L'ancien verdict, tiré de ces deux seuls champs,
 * ne distinguait donc jamais un remux — vidéo copiée, audio converti, résultat
 * parfaitement acceptable — d'un ré-encodage complet de l'image, qui est
 * précisément ce qu'on cherche à supprimer. Sans cette distinction, le critère
 * d'acceptation du chantier n'est pas mesurable.
 */

/** Raisons Jellyfin qui imposent de RECOMPRESSER l'image. */
const RAISONS_REENCODAGE_VIDEO =
  /^(video|refframes|anamorphic|interlaced|unknownvideostream|containerbitrateexceeds)/i;

export type ModeLecture = "DirectPlay" | "DirectStream" | "Remux" | "Transcode";

export interface EntreeVerdict {
  supportsDirectPlay: boolean;
  supportsDirectStream: boolean;
  transcodingUrl?: string;
  transcodeReasons?: string[] | string;
  /** Codec de la piste vidéo source, pour comparer avec le codec de sortie. */
  codecVideoSource?: string;
}

export interface Verdict {
  mode: ModeLecture;
  raisons: string[];
  /** L'image est-elle recompressée ? Le seul critère qui compte ici. */
  reencodageVideo: boolean;
}

/** Jellyfin 10.9+ rend un tableau ; les versions antérieures, une chaîne. */
export function normaliserRaisons(brut?: string[] | string): string[] {
  if (!brut) return [];
  const liste = Array.isArray(brut) ? brut : brut.split(",");
  return liste.map((r) => r.trim()).filter(Boolean);
}

function lireParam(url: string, nom: string): string | undefined {
  const m = new RegExp(`[?&]${nom}=([^&]*)`, "i").exec(url);
  return m ? decodeURIComponent(m[1]) : undefined;
}

function imageRecompressee(
  codecSortie: string | undefined, codecSource: string | undefined, raisons: string[],
): boolean {
  // Jellyfin l'annonce parfois lui-même.
  if (codecSortie?.toLowerCase() === "copy") return false;
  // Sinon les raisons font foi : elles disent ce qui a écarté la lecture
  // directe. Aucune raison vidéo (« AudioCodecNotSupported » seul, par
  // exemple) → ffmpeg copie le flux vidéo et ne touche qu'à l'audio.
  // ⚠️ `ContainerNotSupported` n'est PAS une raison vidéo : c'est un remux.
  if (raisons.length > 0) return raisons.some((r) => RAISONS_REENCODAGE_VIDEO.test(r));
  // Serveur muet sur les raisons : on compare le codec demandé à la source.
  if (codecSortie && codecSource) {
    const sorties = codecSortie.toLowerCase().split(",").map((c) => c.trim());
    return !sorties.includes(codecSource.toLowerCase());
  }
  // Faute d'information, on suppose le pire — un instrument de mesure ne doit
  // jamais flatter le résultat.
  return true;
}

export function evaluerLecture(e: EntreeVerdict): Verdict {
  const raisons = normaliserRaisons(e.transcodeReasons);

  if (e.supportsDirectPlay && !e.transcodingUrl) {
    return { mode: "DirectPlay", raisons, reencodageVideo: false };
  }
  if (!e.transcodingUrl) {
    // Pas d'URL de transcodage : le serveur sert le fichier tel quel, remuxé.
    return {
      mode: e.supportsDirectStream ? "DirectStream" : "Transcode",
      raisons,
      reencodageVideo: !e.supportsDirectStream,
    };
  }

  const reencodageVideo = imageRecompressee(
    lireParam(e.transcodingUrl, "VideoCodec"), e.codecVideoSource, raisons,
  );
  return { mode: reencodageVideo ? "Transcode" : "Remux", raisons, reencodageVideo };
}
