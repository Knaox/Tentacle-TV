import {
  ACCOUNT_SESSION_KEY,
  activeProfileOf,
  enterProfile,
  forgetProfileSession,
  MOBILE_PROFILE_STAY_KEY,
  pickerStayOf,
  returnToAccount,
  writeMobileStay,
  type KeyValueStore,
  type PickedProfileDto,
} from "@tentacle-tv/shared";
import { accountUserId, notifyProfileSessionChange, readActiveProfile } from "./profileSessionCore";
import { writeLaunchChoice } from "./launchChoice";
import { bumpSessionEpoch, clearProfilePickerRequest, requestProfilePicker } from "./sessionEpoch";

/**
 * Les BASCULES de session du mobile — module sans React Native, testé sous
 * vitest (`switchSession.test.ts`). Le stockage s'écrit par le module pur
 * partagé (`profileSessionStore`) ; l'app « repart » ensuite au nom du
 * nouveau profil : cache vidé, époque avancée (`AppProviders` reconstruit son
 * client), puis l'appelant ramène à l'accueil.
 */

export interface SwitchDeps {
  storage: KeyValueStore;
  serverUrl: string;
  /** Vide le cache des requêtes (`queryClient.clear`). */
  clearCache: () => void;
  /** Le temps réel suit la nouvelle session (`switchWtSession`, api-client) :
   *  l'ancienne quitte sa salle Watch Together, la socket se rouvre au nom de
   *  la nouvelle — sans quoi un profil créait une salle tenue par le compte. */
  followSession?: (token: string | null) => void;
}

export type SwitchResult = "stay" | "switched" | "failed";

/** Ce que la case de « Qui regarde ? » à l'ouverture fixe : `stay` cochée, `ask` décochée. */
export type LaunchChoice = "ask" | "stay";

/**
 * La réserve du compte va au TROUSSEAU (`RNStorageAdapter`), qui borne ses
 * valeurs (~2 Ko côté expo-secure-store) : le `tentacle_user` mis de côté y
 * perd `Configuration` (préférences d'affichage de Jellyfin, relues au retour
 * par `refreshStoredUser`) et garde le reste, `Policy` comprise.
 */
export function compactingStore(storage: KeyValueStore): KeyValueStore {
  return {
    getItem: (key) => storage.getItem(key),
    removeItem: (key) => storage.removeItem(key),
    setItem: (key, value) => storage.setItem(key, key === ACCOUNT_SESSION_KEY ? compactStash(value) : value),
  };
}

function compactStash(raw: string): string {
  try {
    const stash = JSON.parse(raw) as { user?: unknown };
    if (typeof stash.user !== "string") return raw;
    const { Configuration: _dropped, ...user } = JSON.parse(stash.user) as Record<string, unknown>;
    return JSON.stringify({ ...stash, user: JSON.stringify(user) });
  } catch {
    return raw;
  }
}

/**
 * Le profil choisi devient le DERNIER choisi de l'appareil ; `launch` — la
 * case « Ne plus proposer au démarrage » de « Qui regarde ? » à l'ouverture —
 * fixe aussi le choix de l'appareil (`stay` cochée, `ask` décochée). Sans
 * elle (« Changer de profil »), le choix reste : case cochée hier, c'est le
 * nouveau profil qui s'ouvrira au prochain démarrage.
 */
function rememberChoice(deps: SwitchDeps, accountId: string | null, picked: PickedProfileDto, launch: LaunchChoice | undefined): void {
  if (!accountId) return;
  if (launch) writeLaunchChoice(deps, launch);
  deps.storage.setItem(
    MOBILE_PROFILE_STAY_KEY,
    writeMobileStay(deps.storage.getItem(MOBILE_PROFILE_STAY_KEY), deps.serverUrl, accountId, pickerStayOf(picked.profile)),
  );
}

/**
 * Ce qui suit la réponse du serveur : son propre profil depuis la session
 * personnelle → rien ne bascule (`stay`) ; son profil depuis celle d'un
 * autre → la session personnelle reprend ; un autre profil → son jeton
 * devient celui de l'app.
 */
export function commitMobilePick(picked: PickedProfileDto, deps: SwitchDeps, launch?: LaunchChoice): SwitchResult {
  const accountId = accountUserId(deps.storage);
  const held = readActiveProfile(deps.storage);
  clearProfilePickerRequest();
  if (picked.personal && !held) {
    rememberChoice(deps, accountId, picked, launch);
    return "stay";
  }
  let swapped: boolean;
  try {
    swapped = picked.personal
      ? returnToAccount(deps.storage)
      : enterProfile(compactingStore(deps.storage), { token: picked.token, user: picked.user, profile: activeProfileOf(picked.profile) });
  } catch {
    swapped = false;
  }
  if (!swapped) return "failed";
  rememberChoice(deps, accountId, picked, launch);
  restart(deps);
  return "switched";
}

/** Oublie le profil retenu (« Changer de profil » : le prochain choix le remplace). */
export function forgetMobileStay(deps: Pick<SwitchDeps, "storage" | "serverUrl">): void {
  const accountId = accountUserId(deps.storage);
  if (!accountId) return;
  deps.storage.setItem(MOBILE_PROFILE_STAY_KEY, writeMobileStay(deps.storage.getItem(MOBILE_PROFILE_STAY_KEY), deps.serverUrl, accountId, null));
}

/**
 * La session de profil a pris fin (le serveur l'a coupée : 401 au
 * rafraîchissement) : retour EN COULISSE à la session personnelle, puis
 * « Qui regarde ? » exigé — jamais le compte sans son code, jamais une
 * déconnexion. Faux hors d'une session de profil (l'appelant fait comme avant).
 */
export function endMobileProfileSession(deps: SwitchDeps, reason: string): boolean {
  if (!readActiveProfile(deps.storage)) return false;
  if (!returnToAccount(deps.storage)) {
    forgetProfileSession(deps.storage);
    return false;
  }
  requestProfilePicker(reason);
  restart(deps);
  return true;
}

/**
 * Plus de connexion pendant une session de profil : l'appareil revient au
 * compte qui s'y est connecté — le hors ligne est le sien, et aucun code PIN ne
 * se vérifie sans serveur (`offline-core` › `offlineSessionFallback`). Sans
 * « Qui regarde ? » exigé : au retour du réseau, rien ne se rouvre au nom d'un
 * profil. Rend le nom du compte revenu (`""` s'il est illisible), ou null si
 * rien n'a basculé (hors profil, réserve illisible : on ne touche à rien).
 */
export function returnToAccountOffline(deps: SwitchDeps): string | null {
  if (!readActiveProfile(deps.storage)) return null;
  if (!returnToAccount(deps.storage)) return null;
  clearProfilePickerRequest();
  restart(deps);
  return storedUserName(deps.storage.getItem("tentacle_user"));
}

function storedUserName(raw: string | null): string {
  try {
    const name = raw ? (JSON.parse(raw) as { Name?: unknown }).Name : null;
    return typeof name === "string" ? name : "";
  } catch {
    return "";
  }
}

/** La déconnexion du compte : la session de profil s'oublie avec lui. */
export function forgetMobileProfileSession(storage: KeyValueStore): void {
  forgetProfileSession(storage);
  notifyProfileSessionChange();
}

function restart(deps: SwitchDeps): void {
  deps.followSession?.(deps.storage.getItem("tentacle_token"));
  deps.clearCache();
  notifyProfileSessionChange();
  bumpSessionEpoch();
}
