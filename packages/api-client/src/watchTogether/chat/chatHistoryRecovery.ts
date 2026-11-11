/**
 * Redemander le fil du groupe (`wt:syncRequest`) — quand, et quand surtout pas.
 *
 * Le serveur envoie le fil (`wt:chatHistory`, même vide) AVEC l'adhésion : invitation
 * acceptée, « Rejoindre ici » — et il AVANCE l'epoch de la salle juste avant. Ce message
 * peut passer avant que le chat n'écoute (sa racine n'est montée qu'une fois la salle
 * connue) : le fil se redemande alors, une fois.
 *
 * À la CRÉATION, le serveur n'envoie aucun fil : la salle naît à l'epoch 0, vide, et rien
 * n'a pu être manqué tant que personne n'y est entré. La redemander serait un envoi pour
 * rien, à chaque groupe créé.
 */

/** L'epoch d'une salle telle que le serveur vient de la créer (`roomStore.ts`). */
export const WT_CREATED_ROOM_EPOCH = 0;

export interface ChatHistoryRecoveryInput {
  /** Le groupe où ce chat vient d'entrer. */
  groupId: string;
  /** L'epoch de la salle au moment où le chat y est entré. */
  epochAtEntry: number;
  /** Le groupe dont le fil est arrivé depuis que le chat écoute, s'il y en a un. */
  receivedGroupId: string | null;
}

/** Vrai : le fil de ce groupe a pu être manqué, il se redemande. */
export function shouldRequestChatHistory({ groupId, epochAtEntry, receivedGroupId }: ChatHistoryRecoveryInput): boolean {
  if (receivedGroupId === groupId) return false;
  return epochAtEntry > WT_CREATED_ROOM_EPOCH;
}
