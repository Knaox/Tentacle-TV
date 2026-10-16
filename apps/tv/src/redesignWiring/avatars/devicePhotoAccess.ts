import { useQuery } from "@tanstack/react-query";
import { tentacleApiFetch, useServerCapabilities, useUserId } from "@tentacle-tv/api-client";

/**
 * Le sujet de la session peut-il poser SA photo depuis cette TV ? La seule
 * porte de la galerie des avatars pour soi (Réglages, première entrée dans un
 * profil) : le serveur sait le faire (`avatars.devicePhoto`) ET le permet à
 * ce compte (`GET /api/avatars/device-photo` — non pour le compte de
 * démonstration de la revue Apple, qui est partagé).
 *
 * `null` : on ne sait pas encore ; `false` : rien à montrer — serveur d'avant,
 * compte de démonstration, ou réponse illisible (jamais une galerie dont
 * l'envoi serait refusé).
 */
export function useDevicePhotoAccess(): boolean | null {
  const { capabilities, known } = useServerCapabilities();
  const capable = capabilities.has("avatars.devicePhoto");
  const userId = useUserId();
  const query = useQuery({
    queryKey: ["avatars-device-photo", userId],
    queryFn: async () => (await tentacleApiFetch<{ allowed?: unknown }>("/api/avatars/device-photo")).allowed === true,
    enabled: capable && !!userId,
    staleTime: 10 * 60_000,
    retry: 1,
  });
  if (!known) return null;
  if (!capable || !userId) return false;
  if (query.data !== undefined) return query.data;
  return query.isError ? false : null;
}
