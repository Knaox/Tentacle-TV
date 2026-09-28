import type { SwipeCard } from "../../swipe/swipeTypes";
import type { WtAffinityKind, WtAffinityVerdict } from "../protocol";

/**
 * Affinité — les formes de l'état en mémoire. Une séance vit avec sa salle
 * (`affinityRegistry.ts`), comme le chat : rien n'est écrit en base, rien ne
 * survit au groupe. La logique est dans `affinitySession.ts` (pure).
 */

/** Une carte de la pile commune : la forme de la pile « Affiner » — le client
 *  la dessine avec les mêmes composants —, toujours un titre de bibliothèque. */
export type AffinityCard = SwipeCard & { jellyfinItemId: string };

export interface AffinityParticipant {
  userId: string;
  joinedAt: number;
  /**
   * Les titres que CE participant peut lire. `null` : toute la pile — un
   * membre présent au lancement y est déjà, la pile étant l'intersection des
   * bibliothèques de la salle. Un membre arrivé après ne voit que la sienne.
   */
  allowed: ReadonlySet<string> | null;
  /** Clé de titre → dernier geste (le dernier geste gagne). */
  votes: Map<string, WtAffinityVerdict>;
  /** Titres passés, dans l'ordre : ils reviennent en fin de pile. */
  skipped: string[];
}

/** Un match — ses champs d'affichage sont recopiés : il survit à un
 *  changement de type, alors que la pile qui l'a produit s'en va. */
export interface AffinityMatch {
  key: string;
  itemId: string;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  at: number;
  likedBy: string[];
  superlikedBy: string[];
}

export interface AffinityLaunch {
  key: string;
  itemId: string;
  byUserId: string;
  at: number;
}

export interface AffinitySession {
  sessionId: number;
  kind: WtAffinityKind;
  startedBy: string;
  startedAt: number;
  /** La pile commune, dans l'ordre que tous voient. */
  deck: AffinityCard[];
  /** Les membres de la salle au lancement : la pile est l'intersection de
   *  LEURS bibliothèques. Un autre membre ne voit que ce qu'il peut lire. */
  audience: ReadonlySet<string>;
  /** Clé → position dans la pile. */
  index: Map<string, number>;
  participants: Map<string, AffinityParticipant>;
  matches: Map<string, AffinityMatch>;
  launch: AffinityLaunch | null;
}
