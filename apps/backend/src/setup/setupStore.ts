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
  /**
   * Pile complète, un AUTRE Jellyfin choisi dans l'assistant : la clé du voisin
   * verrouillé est mise de côté, pour qu'un retour sur lui le reprenne.
   */
  claimKey: "jellyfin_claim_api_key",
  /** Pile complète : l'adresse d'un autre Jellyfin choisi EXPRÈS — le démarrage ne l'oublie pas. */
  stackChoice: "jellyfin_stack_choice",
  /** Un Jellyfin DÉJÀ configuré a été rejoint : l'assistant n'y crée aucune bibliothèque. */
  joined: "setup_jellyfin_joined",
  /** Le Jellyfin choisi à l'étape « Jellyfin », et donc le parcours (`flow/setupFlow.ts`). */
  selection: "setup_jellyfin_selection",
  /** L'adresse du Jellyfin sur lequel CETTE installation a créé la clé « Tentacle » (révocable si on l'abandonne). */
  keyCreatedFor: "setup_jellyfin_key_created",
  /** « Configurer plus tard » la clé TMDB : à la fin, l'avis `tmdbKey` est masqué pour l'administrateur (`flow/tmdbChoice.ts`). */
  tmdbLater: "setup_tmdb_later",
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

/** Un Jellyfin étranger à la pile complète : oublié, clé comprise — et le choix qui le désignait. */
export async function forgetJellyfin(): Promise<void> {
  await deleteConfigValue(SETUP_KEYS.jellyfinUrl);
  await deleteConfigValue(SETUP_KEYS.apiKey);
  await deleteConfigValue(SETUP_KEYS.serverId);
  await deleteConfigValue(SETUP_KEYS.stackChoice);
  await deleteConfigValue(SETUP_KEYS.joined);
  await deleteConfigValue(SETUP_KEYS.selection);
  await deleteConfigValue(SETUP_KEYS.keyCreatedFor);
  await forgetClaim();
  await detectAppState();
}

export async function forgetClaim(): Promise<void> {
  await deleteConfigValue(SETUP_KEYS.claimUserId);
  await deleteConfigValue(SETUP_KEYS.claimSecret);
  await deleteConfigValue(SETUP_KEYS.claimKey);
}

/**
 * La clé du Jellyfin de la pile verrouillé par Tentacle : celle en service,
 * ou celle mise de côté quand un autre Jellyfin a été choisi entre-temps.
 */
export function siblingClaimKey(siblingUrl: string): string | null {
  const stored = storedJellyfin();
  if (stored?.url === siblingUrl) return stored.apiKey;
  return getConfigValue(SETUP_KEYS.claimKey) ?? null;
}

/** Avant de relier un autre Jellyfin : la clé du voisin verrouillé ne se perd pas. */
export async function setClaimAside(siblingUrl: string | null): Promise<void> {
  const stored = storedJellyfin();
  if (!siblingUrl || !claimedAdminId() || stored?.url !== siblingUrl) return;
  await setConfigValue(SETUP_KEYS.claimKey, stored.apiKey);
}

/** Pile complète : un autre Jellyfin que celui de la pile, choisi EXPRÈS — le démarrage ne l'oublie pas. */
export async function rememberStackChoice(url: string, siblingUrl: string | null): Promise<void> {
  if (siblingUrl && url !== siblingUrl) await setConfigValue(SETUP_KEYS.stackChoice, url);
  else await deleteConfigValue(SETUP_KEYS.stackChoice);
}

/**
 * Le choix fait dans l'assistant : un autre Jellyfin que celui de la pile
 * (gardé au prochain démarrage), et s'il était DÉJÀ configuré (rejoint).
 */
export async function rememberChoice(url: string, siblingUrl: string | null, joined: boolean): Promise<void> {
  await rememberStackChoice(url, siblingUrl);
  if (joined) await setConfigValue(SETUP_KEYS.joined, "1");
  else await deleteConfigValue(SETUP_KEYS.joined);
}

export function chosenOverStack(): string | null {
  return getConfigValue(SETUP_KEYS.stackChoice) ?? null;
}

export function joinedConfiguredJellyfin(): boolean {
  return getConfigValue(SETUP_KEYS.joined) === "1";
}
