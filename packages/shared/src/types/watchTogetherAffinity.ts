/**
 * Watch Together — le contrat de l'AFFINITÉ, le swipe de groupe.
 *
 * Recopié octet pour octet dans le backend
 * (`apps/backend/src/services/watchTogether/watchTogetherAffinity.ts`) pour la
 * même raison que `watchTogetherMessages.ts` : le backend CommonJS ne peut pas
 * importer le package shared à l'exécution. `protocolMirror.test.ts` tient les
 * deux copies ensemble — on modifie ICI, on recopie là-bas. Aucun import : le
 * fichier se recopie tel quel.
 *
 * Les gestes (lancer, rejoindre, voter) passent en REST sous
 * `/api/watch-together/affinity` ; seul l'état redescend par le socket, dans
 * `wt:affinity`, hors `wt:state` et de son epoch — un vote ne touche jamais la
 * lecture.
 */

/** Le type de titres d'une séance. Films et séries s'entendent HORS animés ;
 *  « anime » réunit films et séries d'animation japonaise. */
export type WtAffinityKind = "movie" | "series" | "anime";

/** Les deux verdicts du swipe de groupe, rien d'autre : ni coup de cœur, ni
 *  « passer ». Annuler retire le verdict (DELETE). */
export type WtAffinityVerdict = "like" | "dislike";

export interface WtAffinityParticipantDto {
  userId: string;
  /** Cartes jugées pendant la séance. */
  judged: number;
  joinedAt: number;
}

/** Un titre que TOUS les participants ont aimé : la proposition de le
 *  regarder ensemble. */
export interface WtAffinityMatchDto {
  key: string;
  itemId: string;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  /** Les participants au moment du match — tous l'ont aimé. */
  likedBy: string[];
  at: number;
}

/** Un match lancé : ceux qui swipaient suivent le lancement. */
export interface WtAffinityLaunchDto {
  key: string;
  itemId: string;
  byUserId: string;
  at: number;
}

export interface WtAffinityStateDto {
  /** Change à chaque lancement et changement de type : les cartes et les
   *  votes d'une séance précédente ne valent plus. */
  sessionId: number;
  /** Compteur monotone par salle, séances comprises : un état plus vieux que
   *  celui qu'on tient est ignoré. */
  seq: number;
  kind: WtAffinityKind;
  startedBy: string;
  startedAt: number;
  /** Titres de la pile commune. */
  deckSize: number;
  participants: WtAffinityParticipantDto[];
  /** Du plus récent au plus ancien. */
  matches: WtAffinityMatchDto[];
  /** Dernier match lancé — absent tant que personne n'en a lancé. */
  launch?: WtAffinityLaunchDto;
}

export type WtAffinityCause =
  | "start" | "switch" | "join" | "leave" | "vote" | "match" | "unmatch" | "launch" | "end";

/** L'état poussé à chaque changement — `null` quand la séance s'arrête.
 *  `matchKeys` : les titres qui VIENNENT de devenir des matchs. */
export interface WtAffinityMessage {
  type: "wt:affinity";
  state: WtAffinityStateDto | null;
  cause: WtAffinityCause;
  originUserId: string | null;
  matchKeys?: string[];
}
