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
 * Les gestes (lancer, rejoindre, voter, répondre à un match) passent en REST
 * sous `/api/watch-together/affinity` ; seul l'état redescend par le socket,
 * dans `wt:affinity`, hors `wt:state` et de son epoch — un vote ne touche
 * jamais la lecture.
 *
 * La séance est UN mode partagé : la lancer l'ouvre chez tout le groupe, un
 * match s'affiche chez tous en même temps, et la première réponse vaut pour
 * tous ; quand il ne reste plus deux participants, elle se referme chez tous.
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
 *  regarder ensemble, faite à tous en même temps. */
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

export interface WtAffinityStateDto {
  /** Change à chaque lancement, reprise et changement de type : les cartes
   *  et les votes tenus pour une autre séance ne valent plus. */
  sessionId: number;
  /** Compteur monotone par salle, séances comprises : un état plus vieux que
   *  celui qu'on tient est ignoré. */
  seq: number;
  kind: WtAffinityKind;
  startedBy: string;
  startedAt: number;
  /** Titres de la pile commune. */
  deckSize: number;
  /** Qui swipe en ce moment : a ouvert la pile et ne l'a pas quittée. */
  participants: WtAffinityParticipantDto[];
  /** Les matchs en attente de réponse, du plus ancien au plus récent. Le
   *  premier est proposé à tous les participants : « Regarder ensemble »
   *  ou « Continuer à swiper » — le premier qui répond décide pour tous. */
  proposals: WtAffinityMatchDto[];
}

export type WtAffinityCause =
  | "start" | "switch" | "join" | "quit" | "vote" | "match" | "unmatch" | "dismiss" | "launch" | "end";

/**
 * L'état poussé à chaque changement — `null` quand la séance se referme
 * (quitter à deux, un match parti en lecture, la salle sous deux membres).
 * `matchKeys` : les titres qui VIENNENT de devenir des matchs. `match` : le
 * match concerné par « dismiss » (écarté), « unmatch » (défait par un dédit)
 * ou « launch » (parti en lecture).
 */
export interface WtAffinityMessage {
  type: "wt:affinity";
  state: WtAffinityStateDto | null;
  cause: WtAffinityCause;
  originUserId: string | null;
  matchKeys?: string[];
  match?: WtAffinityMatchDto;
}
