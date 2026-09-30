import { useStreamingConfig, useTentacleConfig } from "@tentacle-tv/api-client";
import { useStoredToken } from "./useStoredToken";

/**
 * Le jumelage de cet appareil a-t-il expiré côté serveur ? Le backend signale
 * `tokenExpired` quand le jeton Jellyfin de l'appareil est mort ET que
 * l'auto-réparation (jeton d'un appareil frère) n'a rien pu refournir : la
 * sauvegarde de la progression est alors en pause. Revient à faux dès qu'un
 * jeton frais revient (sondage de 5 min, ou nouveau jumelage).
 *
 * La requête est celle de `DirectStreamingSync` (même clé) : aucune requête
 * de plus. Le jeton est relu (`useStoredToken`) : l'hôte est monté avant le
 * jumelage.
 */
export function usePairingExpired(): boolean {
  const { storage } = useTentacleConfig();
  const token = useStoredToken(storage);
  const { data } = useStreamingConfig(token);
  return data?.tokenExpired === true;
}
