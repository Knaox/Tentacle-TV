/**
 * « Une notification lue ou balayée n'importe où est lue partout » — les
 * règles pures de la synchro entre le centre de notifications du SYSTÈME
 * (iOS, Android) et le serveur. Aucune API native ici : elles se testent
 * seules, `pushSync.ts` les applique.
 */

/** iOS : la réponse d'une notification balayée (catégorie à `customDismissAction`). */
export const DISMISS_ACTION_IDENTIFIER = "com.apple.UNNotificationDismissActionIdentifier";

/** Une notification affichée dans le centre du système, réduite à ce que la synchro lit. */
export interface PresentedEntry {
  /** L'identifiant du système (pour la retirer). */
  requestId: string;
  /** L'identifiant de la notification sur le serveur (`data.notificationId`), s'il y en a un. */
  notificationId: string | null;
}

export function presentedEntryOf(n: { request: { identifier: string; content: { data?: unknown } } }): PresentedEntry {
  const data = n.request.content.data;
  const id = data && typeof data === "object" ? (data as Record<string, unknown>).notificationId : undefined;
  return { requestId: n.request.identifier, notificationId: typeof id === "string" && id.length > 0 ? id : null };
}

/**
 * Le FILET, à chaque retour de l'app : une notification que CE téléphone a
 * vue dans son centre (relevé précédent, ou reçue au premier plan) et qui
 * n'y est plus a été balayée — ou ouverte —, donc lue. Rien d'autre n'est
 * marqué : une push jamais vue ici (arrivée sur un autre appareil, perdue
 * en route) ne l'est jamais.
 */
export function reconcilePresented(input: { known: readonly string[]; presented: readonly PresentedEntry[] }): {
  readNow: string[];
  nextKnown: string[];
} {
  const now = new Set(input.presented.map((p) => p.notificationId).filter((id): id is string => !!id));
  const readNow = [...new Set(input.known)].filter((id) => !now.has(id));
  return { readNow, nextKnown: [...now] };
}

/**
 * L'autre sens : ce qui est lu ailleurs (l'app, un autre appareil) quitte le
 * centre du système de CE téléphone. Seulement ce que la liste du serveur
 * dit LU — une notification hors de la liste lue (trop ancienne) reste ;
 * plus aucune non lue : tout ce qui vient du serveur part.
 */
export function presentedToWithdraw(input: {
  presented: readonly PresentedEntry[];
  serverList: ReadonlyArray<{ id: string; read: boolean }> | undefined;
  unreadCount: number | undefined;
}): PresentedEntry[] {
  const readIds = new Set((input.serverList ?? []).filter((n) => n.read).map((n) => n.id));
  return input.presented.filter((p) => p.notificationId && (input.unreadCount === 0 || readIds.has(p.notificationId)));
}

/** Le relevé garde au plus ce nombre d'identifiants (un centre du système plein n'en montre pas plus). */
export const KNOWN_PRESENTED_MAX = 64;

export function parseKnownPresented(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(-KNOWN_PRESENTED_MAX) : [];
  } catch {
    return [];
  }
}

export function addKnownPresented(known: readonly string[], id: string): string[] {
  return [...known.filter((k) => k !== id), id].slice(-KNOWN_PRESENTED_MAX);
}
