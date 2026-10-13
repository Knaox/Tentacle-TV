import {
  ACCOUNT_SESSION_KEY,
  PROFILE_SESSION_KEY,
  type AccountSession,
  type ActiveProfile,
} from "./profileSession";

/**
 * L'ÉCRITURE des bascules de session du bureau (voir `profileSession.ts`) :
 * entrer dans un profil, revenir à son compte, tout oublier. Seulement le
 * stockage — l'appelant recharge la page ensuite (`profiles/switch/`).
 * Module pur sur un stockage injecté : `sessionSwap.test.ts`.
 *
 * L'identité Jellyfin adoptée (`tentacle_device_id_jf`) suit la session : un
 * profil reçoit la sienne du serveur (`/api/config/streaming` › `deviceId`),
 * le compte retrouve la sienne au retour.
 */

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const TOKEN_KEY = "tentacle_token";
const USER_KEY = "tentacle_user";
const DEVICE_ID_KEY = "tentacle_device_id_jf";

/** Ce que le serveur rend en ouvrant le profil d'un autre. */
export interface ProfileGrant {
  token: string;
  user: { id: string; name: string };
  profile: ActiveProfile;
}

interface StoredAccount extends AccountSession {
  /** L'identité Jellyfin adoptée par la session personnelle, à rendre au retour. */
  deviceId?: string | null;
}

function readStash(store: KeyValueStore): StoredAccount | null {
  try {
    const parsed = JSON.parse(store.getItem(ACCOUNT_SESSION_KEY) ?? "null") as Partial<StoredAccount> | null;
    if (!parsed || typeof parsed.token !== "string" || !parsed.token || typeof parsed.user !== "string") return null;
    return { token: parsed.token, user: parsed.user, deviceId: typeof parsed.deviceId === "string" ? parsed.deviceId : null };
  } catch {
    return null;
  }
}

/** Le `tentacle_user` d'une session de profil : ce que l'application lit d'un compte, jamais administrateur. */
export function profileUserRecord(grant: ProfileGrant): string {
  return JSON.stringify({
    Id: grant.user.id,
    Name: grant.user.name || grant.profile.name,
    ...(grant.profile.imageTag ? { PrimaryImageTag: grant.profile.imageTag } : {}),
    Policy: { IsAdministrator: false },
  });
}

/**
 * Entre dans le profil d'un autre. Depuis la session personnelle, celle-ci est
 * mise de côté (jeton, compte, identité adoptée) ; depuis un autre profil, la
 * réserve ne bouge pas — elle reste celle du compte. Faux si rien ne peut
 * être mis de côté (aucune session active) : l'appelant n'a rien à recharger.
 */
export function enterProfile(store: KeyValueStore, grant: ProfileGrant): boolean {
  if (store.getItem(PROFILE_SESSION_KEY) === null) {
    const token = store.getItem(TOKEN_KEY);
    const user = store.getItem(USER_KEY);
    if (!token || !user) return false;
    const stash: StoredAccount = { token, user, deviceId: store.getItem(DEVICE_ID_KEY) };
    store.setItem(ACCOUNT_SESSION_KEY, JSON.stringify(stash));
  } else if (!readStash(store)) {
    return false;
  }
  store.setItem(TOKEN_KEY, grant.token);
  store.setItem(USER_KEY, profileUserRecord(grant));
  store.setItem(PROFILE_SESSION_KEY, JSON.stringify(grant.profile));
  // L'identité de l'ancienne session ne vaut pas pour ce jeton : le serveur
  // donnera celle du profil (`DirectStreamingSync`).
  store.removeItem(DEVICE_ID_KEY);
  return true;
}

/**
 * Revient à la session personnelle mise de côté. Faux sans réserve (déjà en
 * session personnelle, ou réserve illisible) : rien n'est touché.
 */
export function returnToAccount(store: KeyValueStore): boolean {
  const stash = readStash(store);
  if (!stash) return false;
  store.setItem(TOKEN_KEY, stash.token);
  store.setItem(USER_KEY, stash.user);
  if (stash.deviceId) store.setItem(DEVICE_ID_KEY, stash.deviceId);
  else store.removeItem(DEVICE_ID_KEY);
  store.removeItem(PROFILE_SESSION_KEY);
  store.removeItem(ACCOUNT_SESSION_KEY);
  return true;
}

/** La session de profil oubliée (déconnexion, changement de serveur) : sans trace. */
export function forgetProfileSession(store: KeyValueStore): void {
  store.removeItem(PROFILE_SESSION_KEY);
  store.removeItem(ACCOUNT_SESSION_KEY);
}
