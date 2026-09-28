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
}

/** Un match — ses champs d'affichage sont recopiés : la proposition se montre
 *  sans relire la pile. */
export interface AffinityMatch {
  key: string;
  itemId: string;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  at: number;
  likedBy: string[];
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
  /** Qui swipe en ce moment : a ouvert la pile et ne l'a pas quittée. */
  participants: Map<string, AffinityParticipant>;
  /**
   * Les votes de chacun (clé de titre → dernier verdict), pour toute la vie
   * de la séance : quitter l'affinité ne les efface pas, y revenir les
   * retrouve. Seul un départ du GROUPE les emporte.
   */
  ballots: Map<string, Map<string, WtAffinityVerdict>>;
  /** Les matchs proposés, pas encore tranchés, du plus ancien au plus
   *  récent : le premier est à l'écran de tous les participants. */
  proposals: AffinityMatch[];
  /** Les titres dont le match a été tranché — lancé ou écarté : jamais
   *  reproposés, jamais resservis. */
  settled: Set<string>;
}
