import type { QueryClient } from "@tanstack/react-query";
import {
  JellyfinClient,
  setPreferencesToken,
} from "@tentacle-tv/api-client";
import type { StorageAdapter } from "@tentacle-tv/api-client";
import { refreshWithRetry, attemptReAuth as attemptReAuthHelper } from "./tokenRefresh";
import { readCredentials } from "./credentialManager";
import { unpairDevice } from "./unpair";

/** Un seul rafraîchissement à la fois : l'expiration signalée par le client
 *  Jellyfin, le retour au premier plan et le refus d'authentification de la
 *  socket ne se marchent pas dessus. */
let refreshing = false;

/**
 * Stratégie complète de récupération de session :
 *  1. refreshWithRetry (3 tentatives avec backoff)
 *  2. Si "expired" confirmé → attemptReAuth avec credentials sauvés
 *  3. Si tout échoue : déjumelage SEULEMENT sur révocation confirmée
 *
 * `softFail = true` : appelé proactivement (ex. retour foreground) — si
 * tout échoue on garde la session courante. Le token actuel marche peut-être
 * encore pour les requêtes Jellyfin, et un cycle 5×401 légitime déclenchera
 * un vrai contrôle via setOnAuthExpired.
 *
 * `softFail = false` : appelé après une preuve forte que le token est mort
 * (cycle 5×401 atteint, socket refusée pour révocation).
 */
export async function runAuthRefreshFlow(
  jfClient: JellyfinClient,
  storage: StorageAdapter,
  queryClient: QueryClient,
  opts: { softFail: boolean },
): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  try {
    await refreshFlow(jfClient, storage, queryClient, opts);
  } finally {
    refreshing = false;
  }
}

async function refreshFlow(
  jfClient: JellyfinClient,
  storage: StorageAdapter,
  queryClient: QueryClient,
  opts: { softFail: boolean },
): Promise<void> {
  const token = storage.getItem("tentacle_token");
  const serverUrl = storage.getItem("tentacle_server_url");
  // Sans jeton, il n'y a rien à rafraîchir : l'appareil est déjà à jumeler
  // (l'adresse seule reste après un déjumelage, pour le rejumelage).
  if (!token) return;
  if (!serverUrl) {
    // Un jeton sans serveur n'est pas une session : on la solde.
    if (!opts.softFail) unpairDevice({ jfClient, storage, queryClient }, "incomplete");
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

    // Révocation confirmée (la ligne paired_devices n'existe plus, verdict de
    // base) : le seul 401 qui déjumelle — même en lecture, même en tâche de
    // fond. Un 401 nu (Jellyfin qui refuse, secret en avarie, backend à moitié
    // démarré) CONSERVE la session : les bannières d'état informent.
    if (refresh.revoked === true) {
      unpairDevice({ jfClient, storage, queryClient }, "revoked");
      return;
    }

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
      }
    }
  } finally {
    jfClient.setLoggingIn(false);
  }
}
