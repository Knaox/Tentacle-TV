import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { accountPhotoPath } from "@tentacle-tv/tv-core";

/**
 * La photo du SUJET de la session (profil ouvert, ou compte jumelé) :
 *
 * - en a-t-il une ? Une sonde `HEAD` de son portrait par le proxy (200 : oui,
 *   404 : non ; autre chose : on ne sait pas) — la même réponse pour une TV
 *   passée aux profils ou non, sans lire la Famille. La galerie la relit
 *   après un choix ;
 * - la VERSION de son portrait pour cette session de l'app : le portrait du
 *   compte s'adresse sans étiquette (`usePairedAccount`), et le cache
 *   d'images de React Native rendrait l'ancien jusqu'au redémarrage. Un choix
 *   fait la change : l'adresse change, le portrait se relit. Le proxy sert ce
 *   portrait en `no-store` : au lancement suivant, il est neuf de lui-même.
 */

const OWN_PHOTO_KEY = "own-photo";

/** `true` / `false` : la sonde a tranché ; `"failed"` : elle n'a rien pu dire. */
export type OwnPhotoState = boolean | "failed";

export function ownPhotoQueryKey(userId: string | null): readonly unknown[] {
  return [OWN_PHOTO_KEY, userId];
}

/** La sonde, partagée par la porte de la proposition et les réglages ; null tant qu'elle n'a pas répondu. */
export function useOwnPhotoState(userId: string | null): OwnPhotoState | null {
  const client = useJellyfinClient();
  const { data } = useQuery({
    queryKey: ownPhotoQueryKey(userId),
    queryFn: async (): Promise<OwnPhotoState> => {
      const response = await fetch(accountPhotoPath(client.getBaseUrl(), userId ?? ""), { method: "HEAD" });
      if (response.status === 404) return false;
      return response.ok ? true : "failed";
    },
    enabled: userId !== null,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  return userId !== null && data !== undefined ? data : null;
}

const versions = new Map<string, number>();
const listeners = new Set<() => void>();

/** La photo de `userId` vient de changer sur cette TV. */
export function bumpOwnPhotoVersion(userId: string): void {
  versions.set(userId.toLowerCase(), (versions.get(userId.toLowerCase()) ?? 0) + 1);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** La version du portrait de `userId` pour cette session de l'app (0 : jamais changé ici). */
export function useOwnPhotoVersion(userId: string | null): number {
  return useSyncExternalStore(subscribe, () => (userId ? versions.get(userId.toLowerCase()) ?? 0 : 0));
}
