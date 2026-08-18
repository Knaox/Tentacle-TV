/**
 * Que faire quand la lecture échoue — et dans quel ordre.
 *
 * Une table de capacités, aussi documentée soit-elle, finit par se tromper : LG
 * publie des tableaux qu'elle ne nettoie pas, vend sous un même nom de modèle
 * des dalles aux licences différentes, et laisse `deviceInfo` muet sur des
 * téléviseurs entiers. Le seul signal de restriction définitif est donc un échec
 * observé. C'est ce que ce module mémorise.
 *
 * **L'ordre des étages est tout l'enjeu.** Chacun coûte plus cher que le
 * précédent, et un seul recompresse l'image :
 *
 *   1. le CONTENEUR — le serveur remuxe, l'image et le son sont copiés. C'est
 *      l'étage qui rattrape les défauts les mieux documentés de webOS : le saut
 *      cassé dans un MKV, le Dolby Vision en MKV avant webOS 25 ;
 *   2. l'AUDIO — le serveur convertit la piste, l'image reste copiée. C'est le
 *      chemin obligé du TrueHD et du DTS sur les générations sans licence ;
 *   3. la VIDÉO — l'image est recompressée. **Le seul étage qui coûte vraiment
 *      quelque chose**, et le seul qu'il faille signaler à l'utilisateur ;
 *   4. épuisé — on a tout essayé.
 *
 * C'est exactement l'inverse de ce que fait Moonfin, qui saute au transcodage
 * complet à la première erreur venue — `enableDirectPlay: false,
 * enableDirectStream: false` — y compris pour un hoquet réseau. Descendre d'un
 * étage à la fois coûte une négociation de plus et sauve la lecture directe dans
 * l'immense majorité des cas.
 */

/** Ce que la session a disqualifié, par échec observé et jamais par précaution. */
export interface MemoireReplis {
  conteneurs: string[];
  audio: string[];
  video: string[];
}

export const MEMOIRE_VIDE: MemoireReplis = { conteneurs: [], audio: [], video: [] };

/** La source qui vient d'échouer, telle que Jellyfin l'a décrite. */
export interface SourceEnEchec {
  conteneur?: string;
  codecVideo?: string;
  codecAudio?: string;
}

export type EtageRepli = "conteneur" | "audio" | "video" | "epuise";

export interface Repli {
  memoire: MemoireReplis;
  etage: EtageRepli;
  /** Vrai quand l'étage atteint impose de recompresser l'image. */
  reencodageVideo: boolean;
  /** Ce qui vient d'être retiré — pour le journal. */
  retire: string | null;
}

/** Compare sans se soucier de la casse ni des espaces des noms Jellyfin. */
function normaliser(valeur: string | undefined): string | null {
  if (!valeur) return null;
  const propre = valeur.trim().toLowerCase();
  return propre.length > 0 ? propre : null;
}

function contient(liste: string[], valeur: string): boolean {
  return liste.indexOf(valeur) !== -1;
}

/**
 * Descend d'un étage, et d'un seul.
 *
 * Fonction pure : la mémoire entre, une nouvelle mémoire sort. Rien n'est écrit
 * sur le disque — un redémarrage de l'application repart d'une table propre, ce
 * qui est voulu : une dalle mise à jour ne doit pas traîner les refus de la
 * veille.
 */
export function descendre(memoire: MemoireReplis, source: SourceEnEchec): Repli {
  const conteneur = normaliser(source.conteneur);
  if (conteneur !== null && !contient(memoire.conteneurs, conteneur)) {
    return {
      memoire: { ...memoire, conteneurs: [...memoire.conteneurs, conteneur] },
      etage: "conteneur",
      reencodageVideo: false,
      retire: conteneur,
    };
  }

  const audio = normaliser(source.codecAudio);
  if (audio !== null && !contient(memoire.audio, audio)) {
    return {
      memoire: { ...memoire, audio: [...memoire.audio, audio] },
      etage: "audio",
      reencodageVideo: false,
      retire: audio,
    };
  }

  const video = normaliser(source.codecVideo);
  if (video !== null && !contient(memoire.video, video)) {
    return {
      memoire: { ...memoire, video: [...memoire.video, video] },
      etage: "video",
      // Retirer le codec vidéo des profils de lecture directe, c'est demander au
      // serveur de produire autre chose que la source : l'image sera
      // recompressée. C'est le dernier recours, et il se dit.
      reencodageVideo: true,
      retire: video,
    };
  }

  return { memoire, etage: "epuise", reencodageVideo: true, retire: null };
}

/** Le conteneur survit-il à ce que la session a disqualifié ? */
export function conteneurRetenu(memoire: MemoireReplis, nom: string): boolean {
  // Un conteneur se déclare par groupes — « ts,m2ts,mts ». Il suffit qu'une des
  // extensions ait échoué pour que le groupe entier tombe : le démultiplexeur
  // est le même.
  for (const extension of nom.split(",")) {
    if (contient(memoire.conteneurs, extension.trim().toLowerCase())) return false;
  }
  return true;
}

/** Retire d'une liste de codecs ceux que la session a disqualifiés. */
export function codecsRetenus(disqualifies: string[], codecs: string[]): string[] {
  if (disqualifies.length === 0) return codecs;
  return codecs.filter((codec) => !contient(disqualifies, codec.toLowerCase()));
}

// ── Mémoire de la session ──
//
// Un magasin de module, et non un état React, pour la même raison que
// `mkvNonFiable` dans `usePlaybackInfo` : la disqualification vaut pour toute la
// session, alors que l'état du lecteur est vidé à chaque changement d'épisode.
// Rien n'est écrit sur le disque.

let memoireCourante: MemoireReplis = MEMOIRE_VIDE;

export function memoireReplis(): MemoireReplis {
  return memoireCourante;
}

/** Enregistre un échec et rend l'étage atteint, pour le journal et pour l'UI. */
export function signalerEchecLecture(source: SourceEnEchec): Repli {
  const repli = descendre(memoireCourante, source);
  memoireCourante = repli.memoire;
  console.warn("[Tentacle:TV] repli de lecture", {
    etage: repli.etage,
    retire: repli.retire,
    reencodageVideo: repli.reencodageVideo,
  });
  return repli;
}

/** Repart d'une table propre — utile aux tests, et à une reprise de session. */
export function reinitialiserReplis(): void {
  memoireCourante = MEMOIRE_VIDE;
}
