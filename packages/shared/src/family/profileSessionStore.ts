import type { FamilyProfileColor, FamilyProfileKind } from "./familyContract";
import type { PickerProfileDto } from "./familyPickerContract";

/**
 * La SESSION DE PROFIL d'un appareil hors TV (le bureau, le mobile) — l'app
 * ouverte au nom d'un autre profil de la famille que le compte qui s'y est
 * connecté (docs/FAMILLE.md, « Le bureau »). Ce module est l'ÉCRITURE et la
 * LECTURE pures de son stockage, sur un magasin injecté (localStorage du web,
 * `RNStorageAdapter` du mobile) : `profileSessionStore.test.ts`.
 *
 * - `tentacle_token` / `tentacle_user` : la session ACTIVE, lue partout — le
 *   jeton du profil et son compte ;
 * - `tentacle_account_session` : la session PERSONNELLE du compte mise de côté
 *   le temps du profil — c'est elle qui liste les profils et en ouvre un, et
 *   elle qu'on retrouve en revenant à soi (un SECRET : le mobile la range au
 *   trousseau) ;
 * - `tentacle_profile_session` : la marque du profil actif (nom, couleur,
 *   rôle), qui dit à l'interface ce qu'elle doit taire.
 *
 * Le WEB (plateforme `web`, 1.31.1) ne garde PAS le jeton du compte : le serveur
 * le tient en réserve dans un cookie httpOnly le temps du profil, et le rend
 * derrière SON code (`PickedProfileDto.token`). La réserve de la page ne porte
 * alors que le compte (`tentacle_user`) et la marque `held: "server"`.
 *
 * L'identité Jellyfin adoptée (`tentacle_device_id_jf`) suit la session : un
 * profil reçoit la sienne du serveur (`/api/config/streaming` › `deviceId`),
 * le compte retrouve la sienne au retour.
 *
 * ⚠️ Ces clés sont traversées par une chaîne : jamais renommées.
 */

export const PROFILE_SESSION_KEY = "tentacle_profile_session";
export const ACCOUNT_SESSION_KEY = "tentacle_account_session";
const TOKEN_KEY = "tentacle_token";
const USER_KEY = "tentacle_user";
const DEVICE_ID_KEY = "tentacle_device_id_jf";

/** Les clés de la session de profil : effacées avec elle (déconnexion, changement
 *  de serveur), GARDÉES avec la session active quand on vide le cache. */
export const PROFILE_SESSION_STORAGE_KEYS: readonly string[] = [PROFILE_SESSION_KEY, ACCOUNT_SESSION_KEY];

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Le profil dont la session est active. */
export interface ActiveProfile {
  /** Le compte Jellyfin du profil. */
  id: string;
  name: string;
  kind: FamilyProfileKind;
  color: FamilyProfileColor;
  imageTag: string | null;
  hasPin: boolean;
  /** Un invité que la session personnelle de l'appareil peut habiller (photo) ;
   *  absent d'une marque d'avant la 1.30.0. */
  photoEditable?: boolean;
}

/** La session personnelle mise de côté : son jeton, et son `tentacle_user` tel quel.
 *  `token` null : le serveur la garde (le web, `held: "server"`). */
export interface AccountSession {
  token: string | null;
  user: string;
}

/** Ce que le serveur rend en ouvrant le profil d'un autre. */
export interface ProfileGrant {
  token: string;
  user: { id: string; name: string };
  profile: ActiveProfile;
}

interface StoredAccount extends AccountSession {
  /** L'identité Jellyfin adoptée par la session personnelle, à rendre au retour. */
  deviceId?: string | null;
  /** `server` : le jeton est dans la réserve du serveur (le web), jamais ici. */
  held?: "server";
}

/** Comment entrer dans un profil : `escrowed`, le serveur garde le jeton du compte (le web). */
export interface EnterProfileOptions {
  escrowed?: boolean;
}

function isActiveProfile(value: unknown): value is ActiveProfile {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ActiveProfile>;
  return typeof candidate.id === "string" && !!candidate.id && typeof candidate.name === "string"
    && typeof candidate.kind === "string" && typeof candidate.color === "string";
}

/** Le compte (`Id`) d'un `tentacle_user` ; null s'il est absent ou illisible. */
export function storedUserIdOf(raw: string | null): string | null {
  try {
    const id = raw ? (JSON.parse(raw) as { Id?: unknown }).Id : null;
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}

/**
 * La marque du profil (`tentacle_profile_session`) face à la session ACTIVE :
 *
 * - `none` : aucune marque — la session personnelle ;
 * - `active` : la marque d'un profil, et la session active est la sienne ;
 * - `stale` : la marque d'un profil, mais la session active est celle d'un
 *   AUTRE compte — un reste qu'une sortie passée à côté de ces clés a laissé :
 *   personne ne s'en sert, et la prochaine entrée dans un profil la remplace ;
 * - `unreadable` : une marque illisible.
 */
export type ProfileMarkerState = "none" | "active" | "stale" | "unreadable";

export function profileMarkerIn(store: Pick<KeyValueStore, "getItem">): { state: ProfileMarkerState; profile: ActiveProfile | null } {
  const raw = store.getItem(PROFILE_SESSION_KEY);
  if (raw === null) return { state: "none", profile: null };
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* illisible */
  }
  if (!isActiveProfile(parsed)) return { state: "unreadable", profile: null };
  if (storedUserIdOf(store.getItem(USER_KEY)) !== parsed.id) return { state: "stale", profile: null };
  return { state: "active", profile: { ...parsed, imageTag: parsed.imageTag ?? null, hasPin: parsed.hasPin === true } };
}

function readStash(store: Pick<KeyValueStore, "getItem">): StoredAccount | null {
  try {
    const parsed = JSON.parse(store.getItem(ACCOUNT_SESSION_KEY) ?? "null") as Partial<StoredAccount> | null;
    if (!parsed || typeof parsed.user !== "string") return null;
    const deviceId = typeof parsed.deviceId === "string" ? parsed.deviceId : null;
    if (parsed.held === "server") return { token: null, user: parsed.user, deviceId, held: "server" };
    if (typeof parsed.token !== "string" || !parsed.token) return null;
    return { token: parsed.token, user: parsed.user, deviceId };
  } catch {
    return null;
  }
}

/** Pendant un profil, le jeton du compte est-il dans la réserve du SERVEUR (le web) ? */
export function accountEscrowedIn(store: Pick<KeyValueStore, "getItem">): boolean {
  return profileMarkerIn(store).profile !== null && readStash(store)?.held === "server";
}

/** La session personnelle mise de côté pendant un profil ; null sinon. */
export function accountSessionIn(store: Pick<KeyValueStore, "getItem">): AccountSession | null {
  const stash = readStash(store);
  return stash ? { token: stash.token, user: stash.user } : null;
}

/** Le jeton de la session PERSONNELLE : celui mis de côté pendant un profil, sinon le jeton actif. */
export function accountTokenIn(store: Pick<KeyValueStore, "getItem">): string | null {
  if (profileMarkerIn(store).profile) return readStash(store)?.token ?? null;
  return store.getItem(TOKEN_KEY);
}

/** Le compte de l'application (celui qui s'y est connecté), même pendant un profil. */
export function accountUserIdIn(store: Pick<KeyValueStore, "getItem">): string | null {
  return storedUserIdOf(profileMarkerIn(store).profile ? readStash(store)?.user ?? null : store.getItem(USER_KEY));
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

/** La marque d'un profil choisi sur « Qui regarde ? ». */
export function activeProfileOf(profile: PickerProfileDto): ActiveProfile {
  return {
    id: profile.userId,
    name: profile.name,
    kind: profile.kind,
    color: profile.color,
    imageTag: profile.imageTag,
    hasPin: profile.hasPin,
    photoEditable: profile.photoEditable === true,
  };
}

/**
 * Entre dans le profil d'un autre. Depuis la session personnelle, celle-ci est
 * mise de côté (jeton, compte, identité adoptée) ; depuis un autre profil, la
 * réserve ne bouge pas — elle reste celle du compte. Faux si rien ne peut
 * être mis de côté (aucune session active) : l'appelant n'a rien à recharger.
 *
 * Une marque restée d'une session passée (`stale` : la session active est
 * celle d'un autre compte) vaut la session personnelle : c'est la session
 * ACTIVE qui part en réserve, jamais l'ancienne réserve qui traînait.
 */
export function enterProfile(store: KeyValueStore, grant: ProfileGrant, options: EnterProfileOptions = {}): boolean {
  const marker = profileMarkerIn(store).state;
  if (marker === "none" || marker === "stale") {
    const token = store.getItem(TOKEN_KEY);
    const user = store.getItem(USER_KEY);
    if (!user || (!token && !options.escrowed)) return false;
    // Le web : le serveur a mis le jeton en réserve, la page n'en garde aucune copie.
    const stash: StoredAccount = options.escrowed
      ? { token: null, user, deviceId: store.getItem(DEVICE_ID_KEY), held: "server" }
      : { token, user, deviceId: store.getItem(DEVICE_ID_KEY) };
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
 * session personnelle, ou réserve illisible) : rien n'est touché. Une réserve
 * du serveur (le web) exige le jeton qu'il vient de rendre (`restoredToken`,
 * après le code du compte) : sans lui, faux.
 */
export function returnToAccount(store: KeyValueStore, restoredToken?: string): boolean {
  const stash = readStash(store);
  const token = stash?.token ?? restoredToken ?? null;
  if (!stash || !token) return false;
  store.setItem(TOKEN_KEY, token);
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
