import { useCallback, useEffect, useState } from "react";
import type { WtRoomStateDto } from "@tentacle-tv/shared";

/**
 * Les invitations que l'hôte a ENVOYÉES et qui attendent une réponse — pour
 * que la salle les montre (« Alice · invitation envoyée ») au lieu de les
 * oublier dès le clic.
 *
 * Une invitation quitte la liste quand la personne répond (`wt:inviteResult`,
 * accepté ou refusé — le toast le dit), quand elle apparaît parmi les membres,
 * ou quand la salle n'existe plus. Le serveur ne les fait pas expirer : tant
 * que la salle vit, « en attente » dit vrai.
 *
 * En mémoire seulement : le serveur n'expose pas les invitations d'une salle,
 * et un rechargement les oublie — la réponse, elle, arrivera quand même.
 */

export interface WtPendingInvite {
  userId: string;
  username: string;
  hasAvatar: boolean;
  sentAt: number;
}

export function usePendingInvites(room: WtRoomStateDto | null) {
  const [pending, setPending] = useState<WtPendingInvite[]>([]);
  const groupId = room?.groupId ?? null;

  // Une autre salle (ou plus de salle) : les invitations d'avant ne la concernent pas.
  useEffect(() => {
    setPending([]);
  }, [groupId]);

  // Arrivé dans la salle : l'invitation a abouti.
  const members = room?.members;
  useEffect(() => {
    if (!members) return;
    setPending((current) => {
      const next = current.filter((p) => !members.some((m) => m.userId === p.userId));
      return next.length === current.length ? current : next;
    });
  }, [members]);

  const add = useCallback((invites: Array<Omit<WtPendingInvite, "sentAt">>) => {
    const now = Date.now();
    setPending((current) => [
      ...current.filter((p) => !invites.some((i) => i.userId === p.userId)),
      ...invites.map((i) => ({ ...i, sentAt: now })),
    ]);
  }, []);

  const resolve = useCallback((userId: string) => {
    setPending((current) => current.filter((p) => p.userId !== userId));
  }, []);

  return { pending, add, resolve };
}
