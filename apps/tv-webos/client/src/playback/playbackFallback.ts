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
export interface FallbackMemory {
  containers: string[];
  audio: string[];
  video: string[];
}

export const EMPTY_MEMORY: FallbackMemory = { containers: [], audio: [], video: [] };

/** La source qui vient d'échouer, telle que Jellyfin l'a décrite. */
export interface FailedSource {
  container?: string;
  videoCodec?: string;
  audioCodec?: string;
}

export type FallbackStage = "conteneur" | "audio" | "video" | "epuise";

export interface Fallback {
  memory: FallbackMemory;
  stage: FallbackStage;
  /** Vrai quand l'étage atteint impose de recompresser l'image. */
  videoReencoded: boolean;
  /** Ce qui vient d'être retiré — pour le journal. */
  removed: string | null;
}

/** Compare sans se soucier de la casse ni des espaces des noms Jellyfin. */
function normalize(value: string | undefined): string | null {
  if (!value) return null;
  const clean = value.trim().toLowerCase();
  return clean.length > 0 ? clean : null;
}

function contains(list: string[], value: string): boolean {
  return list.indexOf(value) !== -1;
}

/**
 * Descend d'un étage, et d'un seul.
 *
 * Fonction pure : la mémoire entre, une nouvelle mémoire sort. Rien n'est écrit
 * sur le disque — un redémarrage de l'application repart d'une table propre, ce
 * qui est voulu : une dalle mise à jour ne doit pas traîner les refus de la
 * veille.
 */
export function stepDown(memory: FallbackMemory, source: FailedSource): Fallback {
  const container = normalize(source.container);
  if (container !== null && !contains(memory.containers, container)) {
    return {
      memory: { ...memory, containers: [...memory.containers, container] },
      stage: "conteneur",
      videoReencoded: false,
      removed: container,
    };
  }

  const audio = normalize(source.audioCodec);
  if (audio !== null && !contains(memory.audio, audio)) {
    return {
      memory: { ...memory, audio: [...memory.audio, audio] },
      stage: "audio",
      videoReencoded: false,
      removed: audio,
    };
  }

  const video = normalize(source.videoCodec);
  if (video !== null && !contains(memory.video, video)) {
    return {
      memory: { ...memory, video: [...memory.video, video] },
      stage: "video",
      // Retirer le codec vidéo des profils de lecture directe, c'est demander au
      // serveur de produire autre chose que la source : l'image sera
      // recompressée. C'est le dernier recours, et il se dit.
      videoReencoded: true,
      removed: video,
    };
  }

  return { memory, stage: "epuise", videoReencoded: true, removed: null };
}

/** Le conteneur survit-il à ce que la session a disqualifié ? */
export function keptContainer(memory: FallbackMemory, name: string): boolean {
  // Un conteneur se déclare par groupes — « ts,m2ts,mts ». Il suffit qu'une des
  // extensions ait échoué pour que le groupe entier tombe : le démultiplexeur
  // est le même.
  for (const extension of name.split(",")) {
    if (contains(memory.containers, extension.trim().toLowerCase())) return false;
  }
  return true;
}

/** Retire d'une liste de codecs ceux que la session a disqualifiés. */
export function keptCodecs(disqualified: string[], codecs: string[]): string[] {
  if (disqualified.length === 0) return codecs;
  return codecs.filter((codec) => !contains(disqualified, codec.toLowerCase()));
}

// ── Mémoire de la session ──
//
// Un magasin de module, et non un état React, pour la même raison que
// `mkvUnreliable` dans `usePlaybackInfo` : la disqualification vaut pour toute la
// session, alors que l'état du lecteur est vidé à chaque changement d'épisode.
// Rien n'est écrit sur le disque.

let currentMemory: FallbackMemory = EMPTY_MEMORY;

export function fallbackMemory(): FallbackMemory {
  return currentMemory;
}

/** Enregistre un échec et rend l'étage atteint, pour le journal et pour l'UI. */
export function reportPlaybackFailure(source: FailedSource): Fallback {
  const fallback = stepDown(currentMemory, source);
  currentMemory = fallback.memory;
  console.warn("[Tentacle:TV] repli de lecture", {
    stage: fallback.stage,
    removed: fallback.removed,
    videoReencoded: fallback.videoReencoded,
  });
  return fallback;
}

/** Repart d'une table propre — utile aux tests, et à une reprise de session. */
export function resetFallbacks(): void {
  currentMemory = EMPTY_MEMORY;
}
