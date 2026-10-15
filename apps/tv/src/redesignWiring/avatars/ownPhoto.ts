import { useQuery } from "@tanstack/react-query";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { accountPhotoPath } from "@tentacle-tv/tv-core";

/**
 * La photo du SUJET de la session (profil ouvert, ou compte jumelé) :
 * en a-t-il une ? Une sonde `HEAD` de son portrait par le proxy (200 : oui,
 * 404 : non ; autre chose : on ne sait pas) — la même réponse pour une TV
 * passée aux profils ou non, sans lire la Famille. La galerie la relit après
 * un choix (et fait changer la version du portrait, `lib/ownPhotoVersion`).
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
