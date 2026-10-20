/**
 * Watch Together — l'adhésion PAR APPAREIL (serveur 1.32.0, capacité
 * `watchTogether.deviceMembership`).
 *
 * Un compte membre d'une salle n'y entre plus avec TOUS ses appareils : seuls
 * ceux qui l'ont créée, rejointe ou ajoutée (« Rejoindre ici ») y sont LIÉS —
 * un appareil, c'est le jeton qui ouvre sa socket et ses appels. Un autre
 * appareil du même compte ne reçoit rien de la séance (ni état, ni lancement,
 * ni chat) ; il n'en apprend que l'existence, par cet avis, pour proposer
 * discrètement « Groupe en cours sur un autre appareil — rejoindre ici ? ».
 *
 * Recopié tel quel dans le backend
 * (`apps/backend/src/services/watchTogether/watchTogetherDevices.ts`) — aucun
 * import, `cp` suffit ; `protocolMirror.test.ts` tient les deux copies.
 */

/** Ce qu'un appareil NON lié sait de la salle de son compte. */
export interface WtElsewhereDto {
  groupId: string;
  /** Nom de l'hôte de la salle (« Groupe d'Alice »). */
  hostUsername: string;
  /** Titre en cours dans la salle (null : salle sans lecture lancée). */
  itemId: string | null;
  /** Nombre de comptes dans la salle. */
  memberCount: number;
  /** Nombre d'appareils de CE compte liés à la salle. */
  deviceCount: number;
}

/** Serveur → appareils non liés d'un compte membre : l'avis, ou sa fin (`null`). */
export interface WtElsewhereMessage {
  type: "wt:elsewhere";
  elsewhere: WtElsewhereDto | null;
}

/** Refus de `POST /group/join-here` : rien à rejoindre depuis cet appareil. */
export const WT_NOT_ELSEWHERE = "not_elsewhere";
