import type { QueryClient } from "@tanstack/react-query";
import {
  JellyfinClient,
  setPreferencesToken,
} from "@tentacle-tv/api-client";
import type { RNStorageAdapter } from "../storage/RNStorageAdapter";
import { navigationRef } from "../navigation/navigationRef";
import { refreshWithRetry, attemptReAuth as attemptReAuthHelper } from "./tokenRefresh";
import { readCredentials, clearCredentials } from "./credentialManager";
import { isPlayingMedia } from "./playbackGuard";

/** Force le retour à l'écran de jumellage en nettoyant la session locale.
 *  Bloqué pendant la lecture : un user qui regarde un film ne doit JAMAIS être
 *  éjecté à cause d'une erreur réseau ou d'un redémarrage backend transitoire.
 *  Si le token est vraiment mort, on attendra la fin de la lecture pour
 *  redemander une auth. */
export function doLogout(
  jfClient: JellyfinClient,
  storage: RNStorageAdapter,
  queryClient: QueryClient,
): void {
  if (isPlayingMedia()) {
    console.warn("[Auth] doLogout bloqué : lecture en cours — la session est conservée");
    return;
  }
  storage.removeItem("tentacle_token");
  storage.removeItem("tentacle_user");
  storage.removeItem("tentacle_jellyfin_token");
  storage.removeItem("tentacle_jellyfin_url");
  clearCredentials(storage);
  setPreferencesToken(null);
  jfClient.setAccessToken(null);
  queryClient.clear();
  if (navigationRef.isReady()) {
    // Pas de page de login sur TV : on repart sur le jumellage.
    navigationRef.reset({ index: 0, routes: [{ name: "PairCode" }] });
  }
}

/**
 * Stratégie complète de récupération de session :
 *  1. refreshWithRetry (3 tentatives avec backoff)
 *  2. Si "expired" confirmé → attemptReAuth avec credentials sauvés
 *  3. Si tout échoue : doLogout (forte preuve) ou skip (soft fail)
 *
 * `softFail = true` : appelé proactivement (ex. retour foreground) — si
 * tout échoue on garde la session courante. Le token actuel marche peut-être
 * encore pour les requêtes Jellyfin, et un cycle 5×401 légitime déclenchera
 * un vrai logout via setOnAuthExpired.
 *
 * `softFail = false` : appelé après une preuve forte que le token est mort
 * (cycle 5×401 atteint). Si tout échoue : logout.
 */
export async function runAuthRefreshFlow(
  jfClient: JellyfinClient,
  storage: RNStorageAdapter,
  queryClient: QueryClient,
  opts: { softFail: boolean },
): Promise<void> {
  const token = storage.getItem("tentacle_token");
  const serverUrl = storage.getItem("tentacle_server_url");
  if (!token || !serverUrl) {
    if (!opts.softFail) doLogout(jfClient, storage, queryClient);
    return;
  }

  // Pendant le refresh, marque le client comme "logging in" : les 401 reçus
  // par les requêtes en vol ne s'accumulent pas dans le compteur AUTH_EXPIRE
  // — sinon on déclenche un setOnAuthExpired récursif et on boucle.
  jfClient.setLoggingIn(true);
  try {
    const refresh = await refreshWithRetry({ serverUrl, token });
    if (refresh.ok) {
      jfClient.setAccessToken(refresh.accessToken);
      setPreferencesToken(refresh.accessToken);
      storage.setItem("tentacle_token", refresh.accessToken);
      jfClient.resetAuthState();
      return;
    }

    // Réseau/serveur down : garder la session intacte.
    if (refresh.reason !== "expired") return;

    // Token réellement expiré — tenter un re-login avec les credentials sauvés
    const creds = readCredentials(storage);
    if (creds) {
      const newToken = await attemptReAuthHelper({
        serverUrl,
        username: creds.username,
        password: creds.password,
      });
      if (newToken) {
        jfClient.setAccessToken(newToken);
        setPreferencesToken(newToken);
        storage.setItem("tentacle_token", newToken);
        jfClient.resetAuthState();
        return;
      }
    }

    // Plus aucun moyen de récupérer la session.
    // softFail (ex. retour foreground) : on n'éjecte pas l'utilisateur — le
    // token actuel marche peut-être pour Jellyfin (le refresh endpoint peut
    // être plus strict que les routes proxy), et le cycle 5×401 légitime
    // se chargera de logout en dernier recours.
    if (!opts.softFail) doLogout(jfClient, storage, queryClient);
  } finally {
    jfClient.setLoggingIn(false);
  }
}
