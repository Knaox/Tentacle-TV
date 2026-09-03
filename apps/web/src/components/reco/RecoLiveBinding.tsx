import { useJellyfinClient, useRecoLive } from "@tentacle-tv/api-client";

/**
 * Monte le fil temps réel des recommandations pour toute la session
 * authentifiée : `reco:update` (snapshot reconstruit en fond) → la page en
 * cache se rafraîchit en silence, où que l'on soit — la prochaine visite est
 * déjà à jour. Même jeton que l'accueil (cookie sur le web, jeton ailleurs).
 */
export function RecoLiveBinding() {
  const client = useJellyfinClient();
  const token = client.getAccessToken() || localStorage.getItem("tentacle_token");
  useRecoLive({ token });
  return null;
}
