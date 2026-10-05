import { deleteConfigValue, detectAppState, getConfigValue, setConfigValue } from "../services/configStore";
import { restartJellyfinWs } from "../services/jellyfinWs";

/**
 * Ce que l'assistant enregistre, dans `server_config`. Les deux premières clés
 * sont celles que tout le serveur lit déjà ; les autres n'existent que le
 * temps de l'installation (sauf l'identifiant du Jellyfin, gardé pour
 * reconnaître, vu de l'extérieur, que c'est bien LE nôtre).
 */
export const SETUP_KEYS = {
  jellyfinUrl: "jellyfin_url",
  apiKey: "jellyfin_api_key",
  serverId: "jellyfin_server_id",
  /** L'administrateur provisoire qui verrouille le Jellyfin voisin. */
  claimUserId: "jellyfin_claim_user_id",
  /** Son mot de passe aléatoire : seulement le temps d'obtenir la clé (reprise après un arrêt). */
  claimSecret: "jellyfin_claim_secret",
} as const;

export interface StoredJellyfin {
  url: string;
  apiKey: string;
}

export function storedJellyfin(): StoredJellyfin | null {
  const url = getConfigValue(SETUP_KEYS.jellyfinUrl);
  const apiKey = getConfigValue(SETUP_KEYS.apiKey);
  return url && apiKey ? { url, apiKey } : null;
}

export function claimedAdminId(): string | null {
  return getConfigValue(SETUP_KEYS.claimUserId) ?? null;
}

/** Jellyfin relié : le serveur s'en sert aussitôt (WebSocket, état de l'installation). */
export async function saveJellyfin(url: string, apiKey: string, serverId: string): Promise<void> {
  await setConfigValue(SETUP_KEYS.jellyfinUrl, url);
  await setConfigValue(SETUP_KEYS.apiKey, apiKey);
  await setConfigValue(SETUP_KEYS.serverId, serverId);
  restartJellyfinWs();
  await detectAppState();
}

export async function forgetClaim(): Promise<void> {
  await deleteConfigValue(SETUP_KEYS.claimUserId);
  await deleteConfigValue(SETUP_KEYS.claimSecret);
}
