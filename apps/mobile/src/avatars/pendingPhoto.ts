/**
 * La photo envoyée dont la relecture du profil n'a pas rapporté la nouvelle
 * étiquette (réseau coupé entre l'envoi et la relecture) : une valeur locale
 * force la nouvelle image tant que l'étiquette stockée reste l'ancienne. Au
 * niveau du module, pas d'un écran : l'envoi peut partir de la galerie ouverte
 * par l'invitation, loin de la photo du profil qui l'affiche.
 *
 * Module PUR (ni React Native ni Expo) : testé sous vitest.
 */

interface PendingPhoto {
  userId: string;
  /** L'étiquette d'avant l'envoi : tant que le profil stocké la garde, la photo est en attente. */
  staleTag: string | null;
  nonce: string;
}

let pending: PendingPhoto | null = null;
const listeners = new Set<() => void>();

export function markPhotoPending(userId: string, staleTag: string | null, now: number = Date.now()): void {
  pending = { userId, staleTag, nonce: `${now}` };
  for (const listener of listeners) listener();
}

/** L'étiquette à mettre dans l'URL de la photo : la valeur locale tant que l'envoi n'est pas relu. */
export function photoTagFor(userId: string | null, storedTag: string | null): string | null {
  if (pending !== null && pending.userId === userId && pending.staleTag === storedTag) return pending.nonce;
  return storedTag;
}

export function subscribePendingPhoto(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** L'instantané pour `useSyncExternalStore`. */
export function pendingPhotoSnapshot(): PendingPhoto | null {
  return pending;
}
