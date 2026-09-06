import { useJellyfinClient, usePreferencesLive } from "@tentacle-tv/api-client";

/**
 * Monte le fil temps réel des préférences pour toute la session
 * authentifiée : `preferences:update` (un autre appareil a enregistré la mise
 * en page de l'accueil ou les réglages de recommandation) → le bloc en cache
 * se relit en silence, l'accueil se réordonne sans rien toucher. Même jeton
 * que RecoLiveBinding (cookie sur le web, jeton ailleurs).
 */
export function PreferencesLiveBinding() {
  const client = useJellyfinClient();
  const token = client.getAccessToken() || localStorage.getItem("tentacle_token");
  usePreferencesLive({ token });
  return null;
}
