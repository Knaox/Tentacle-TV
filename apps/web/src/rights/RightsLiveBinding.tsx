import { useJellyfinClient, useRightsLive } from "@tentacle-tv/api-client";

/**
 * Les droits en direct pour toute la session authentifiée (web, bureau) :
 * `rights:changed` (capacité `rights.live`) — un droit réglé ailleurs (fiche des
 * droits, Famille, Jellyfin) relit ce qui est à l'écran et oublie le reste.
 * Même jeton que les autres fils (cookie sur le web, jeton ailleurs).
 */
export function RightsLiveBinding() {
  const client = useJellyfinClient();
  const token = client.getAccessToken() || localStorage.getItem("tentacle_token");
  useRightsLive({ token });
  return null;
}
