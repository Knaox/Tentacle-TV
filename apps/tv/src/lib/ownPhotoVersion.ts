import { useSyncExternalStore } from "react";

/**
 * La VERSION du portrait d'un compte pour cette session de l'app (Apple TV,
 * Android TV). Le portrait du compte s'adresse sans étiquette
 * (`usePairedAccount`) : après un choix dans la galerie des avatars, le cache
 * d'images de React Native rendrait l'ancien jusqu'au redémarrage. Le choix
 * fait changer la version, donc l'adresse, et le portrait se relit. Le proxy
 * sert ce portrait en `no-store` : au lancement suivant, il est neuf de
 * lui-même — d'où une version en mémoire seulement.
 */

const versions = new Map<string, number>();
const listeners = new Set<() => void>();

/** La photo de `userId` vient de changer sur cette TV. */
export function bumpOwnPhotoVersion(userId: string): void {
  const key = userId.toLowerCase();
  versions.set(key, (versions.get(key) ?? 0) + 1);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** La version du portrait de `userId` (0 : jamais changé ici). */
export function useOwnPhotoVersion(userId: string | null): number {
  return useSyncExternalStore(subscribe, () => (userId ? versions.get(userId.toLowerCase()) ?? 0 : 0));
}
