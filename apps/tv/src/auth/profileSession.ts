import { i18n } from "@tentacle-tv/shared";
import type { TvProfileDto, TvSessionDto } from "@tentacle-tv/shared";
import {
  fetchInterfaceLanguage,
  flushPlaybackOutboxFor,
  rehydratePlaybackSettings,
  rehydrateStillWatching,
  resetSocketSession,
  resetStillWatchingSession,
  setPreferencesToken,
} from "@tentacle-tv/api-client";
import {
  PROFILE_RESUME_HOLD_MS,
  PROFILE_STORAGE_KEYS,
  beginProfileLeave,
  reclaimRevocation,
  releaseHeldRevocations,
  coldStartProfile,
  endWipe,
  profileRecordOf,
  readProfileRecord,
  tvSessionMode,
  wipeAccount,
  writeProfileRecord,
  honorTvPromptsReset,
  type HeldProfileSession,
  type ProfileIntent,
  type ProfileLaunch,
  type ProfilesListingRef,
} from "@tentacle-tv/tv-core";
import { navigationRef } from "../navigation/navigationRef";
import { scheduleRevocationDrain } from "./revocationQueue";
import { notifySessionChanged } from "./sessionEvents";
import type { UnpairContext } from "./unpair";

/**
 * La SESSION DE PROFIL de l'Apple TV (Famille) — l'ouvrir, la quitter. Le
 * jeton d'une session de profil est un jeton d'appareil au nom du profil : il
 * devient LE jeton de l'app (`tentacle_token` : préférences, socket, proxy,
 * direct, rafraîchissement), exactement comme un jumelage d'avant les profils.
 * Contrat : docs/FAMILLE.md ; règles : tv-core `session/`.
 *
 * Rien d'un profil ne fuit dans un autre : en le quittant, la TV oublie ses
 * jetons (le rouvrir repasse par le serveur, et par le PIN), son cache de
 * requêtes, sa file de rapports de lecture, sa lecture directe, sa socket —
 * tout ce que `PROFILE_STORAGE_KEYS` range, et ce que la mémoire en garde.
 */

/** Le temps laissé à la file des rapports de lecture pour partir avec le jeton du profil qu'on quitte. */
const OUTBOX_FLUSH_BUDGET_MS = 3_000;

/** Le profil qu'on vient de quitter — « Qui regarde ? » y pose le focus. En
 *  mémoire seulement : il ne dit rien qui doive survivre à l'app. */
let lastProfileId: string | null = null;
export function lastLeftProfileId(): string | null {
  return lastProfileId;
}

/** La session quittée par « Changer de profil », reprenable le temps de « Qui
 *  regarde ? » (tv-core `profileResume`). En mémoire seulement : relancer
 *  l'app ne contourne jamais un PIN. */
let held: HeldProfileSession | null = null;
export function heldProfileSession(): HeldProfileSession | null {
  return held;
}

/** La session gardée n'est plus reprenable : sa révocation part tout de suite. */
function releaseHeld(storage: UnpairContext["storage"]): void {
  if (!held) return;
  const { token } = held;
  held = null;
  if (releaseHeldRevocations(storage, Date.now(), token)) scheduleRevocationDrain(0);
}

/**
 * Reprend la session gardée pour `profile` (le même profil choisi de nouveau
 * dans « Qui regarde ? ») : ni PIN, ni appel au serveur — sa révocation sort
 * de la file. `false` : rien à reprendre (déjà révoquée, délai passé), le
 * profil s'ouvre comme un autre.
 */
export function resumeHeldProfile(
  context: Pick<UnpairContext, "jfClient" | "storage">,
  listing: ProfilesListingRef,
  profile: TvProfileDto,
): boolean {
  const keep = held;
  held = null;
  if (!keep || !reclaimRevocation(context.storage, keep.token, Date.now())) return false;
  const session: TvSessionDto = { token: keep.token, user: { id: profile.userId, name: profile.name }, profile, remembered: false };
  adoptProfileSession(context, session, listing, keep.launch);
  return true;
}

/** Pourquoi on revient à « Qui regarde ? » — l'écran en tire le profil à ouvrir (`planProfileLaunch`). */
export type ProfilesRouteIntent = ProfileIntent;

/**
 * Adopte une session de profil que le serveur vient d'ouvrir. La lecture
 * directe repart de zéro : son jeton Jellyfin et son identité d'appareil sont
 * PROPRES à cette session (`DirectStreamingSync` les redemande aussitôt).
 */
export function adoptProfileSession(
  { jfClient, storage }: Pick<UnpairContext, "jfClient" | "storage">,
  session: TvSessionDto,
  listing: ProfilesListingRef,
  launch: ProfileLaunch,
): void {
  // Un AUTRE profil s'ouvre : la session gardée ne se reprendra plus (le serveur la ferme de toute façon).
  if (held && held.token !== session.token) releaseHeld(storage);
  storage.removeItem("tentacle_jellyfin_token");
  storage.removeItem("tentacle_jellyfin_url");
  jfClient.setDirectStreaming(null);
  jfClient.adoptJellyfinDeviceId(null);
  jfClient.resetAuthState();
  jfClient.setAccessToken(session.token);
  setPreferencesToken(session.token);
  storage.setItem("tentacle_token", session.token);
  storage.setItem("tentacle_user", JSON.stringify({ Id: session.user.id, Name: session.user.name }));
  // « Reproposer le code PIN et la photo » (serveur 1.30.0) : AVANT le profil retenu, que le registre
  // du démarrage lit aussitôt.
  honorTvPromptsReset(storage, session.profile);
  writeProfileRecord(storage, profileRecordOf(session.profile, listing, session.remembered ? "sticky" : launch));
  notifySessionChanged();
  void followProfileLanguage(storage, session.token);
}

/** La langue de l'interface suit le COMPTE (le serveur la garde) : celle du profil ouvert. */
async function followProfileLanguage(storage: UnpairContext["storage"], token: string): Promise<void> {
  const language = await fetchInterfaceLanguage(token).catch(() => null);
  if (!language || language === i18n.language || storage.getItem("tentacle_token") !== token) return;
  void i18n.changeLanguage(language);
  storage.setItem("tentacle_language", language);
}

/** Va à « Qui regarde ? », seule page de la pile (Retour y quitte l'application). `returnTo` : la page d'où l'on revient. */
export function showProfiles(intent: ProfilesRouteIntent, returnTo?: "manage"): void {
  if (!navigationRef.isReady()) return;
  navigationRef.reset({ index: 0, routes: [{ name: "Profiles", params: returnTo ? { intent, returnTo } : { intent } }] });
}

/**
 * Quitte la session de profil — synchrone et local, comme le déjumelage :
 * 1. le marqueur (`beginProfileLeave`) : la sortie est déclarée en cours, le
 *    jeton de la session mis de côté pour sa révocation — un plantage à partir
 *    d'ici est rejoué au démarrage, sans déjumeler la TV ;
 * 2. la mémoire : client Jellyfin, lecture directe, préférences, cache des
 *    requêtes, socket ;
 * 3. le stockage : les clés de la session (`PROFILE_STORAGE_KEYS`) — le
 *    jumelage, lui, reste ;
 * 4. « Qui regarde ? » ;
 * 5. la révocation de la session, en tâche de fond, rejouée jusqu'à
 *    confirmation (`POST /api/pair/self/revoke` porté par le jeton de la
 *    session : il ne ferme qu'elle).
 *
 * `serverEnded` : le serveur a déjà fermé la session (retrait, PIN changé,
 * coupure par l'admin…) — il n'y a plus rien à lui demander.
 *
 * `hold` (« Changer de profil ») : la session est GARDÉE le temps de « Qui
 * regarde ? » — sa révocation attend `PROFILE_RESUME_HOLD_MS` ; rouvrir le
 * même profil la reprend sans PIN (`resumeHeldProfile`).
 */
export function leaveProfile(
  { jfClient, storage, queryClient }: UnpairContext,
  intent: ProfilesRouteIntent,
  { serverEnded = false, returnTo, hold = false }: { serverEnded?: boolean; returnTo?: "manage"; hold?: boolean } = {},
): void {
  releaseHeld(storage);
  if (tvSessionMode(storage) !== "profile" && !storage.getItem("tentacle_token")) {
    showProfiles(intent, returnTo);
    return;
  }
  const token = storage.getItem("tentacle_token");
  const serverUrl = storage.getItem("tentacle_server_url");
  const record = readProfileRecord(storage);
  lastProfileId = record?.profileId ?? lastProfileId;
  const now = Date.now();
  const holdUntil = hold && !serverEnded && token && record ? now + PROFILE_RESUME_HOLD_MS : undefined;
  beginProfileLeave(storage, serverEnded ? null : { serverUrl, token }, now, holdUntil);
  if (holdUntil !== undefined && token && record) held = { profileId: record.profileId, token, launch: record.launch, until: holdUntil };

  jfClient.setAccessToken(null);
  jfClient.setDirectStreaming(null);
  jfClient.adoptJellyfinDeviceId(null);
  jfClient.resetAuthState();
  setPreferencesToken(null);
  queryClient.clear();
  resetSocketSession();

  wipeAccount(storage, PROFILE_STORAGE_KEYS);
  rehydratePlaybackSettings();
  rehydrateStillWatching();
  // Le temps regardé sans geste était celui du profil qu'on quitte.
  resetStillWatchingSession();
  endWipe(storage);

  notifySessionChanged();
  showProfiles(intent, returnTo);
  if (!serverEnded && token && serverUrl) scheduleRevocationDrain(0);
}

/**
 * « Changer de profil » : la file des rapports de lecture part d'abord avec le
 * jeton du profil qu'on quitte (bornée : un serveur muet ne retient pas le
 * geste), puis la sortie — session GARDÉE : rouvrir ce profil ne redemande
 * pas son PIN.
 */
export async function switchProfile(context: UnpairContext): Promise<void> {
  const record = readProfileRecord(context.storage);
  if (record) {
    const flush = flushPlaybackOutboxFor(context.jfClient, record.profileId).catch(() => undefined);
    await Promise.race([flush, new Promise((resolve) => setTimeout(resolve, OUTBOX_FLUSH_BUDGET_MS))]);
  }
  leaveProfile(context, "switch", { hold: true });
}

/**
 * La session de profil a cessé côté serveur (`family:profile-ended`, ou un 401
 * `profileEnded` à une porte) : retour à « Qui regarde ? » — la rangée : aucun
 * profil ne s'ouvre à la place de celui qu'on vient de couper —, jamais au
 * jumelage. Sans session de profil ouverte, rien à faire.
 */
export function endedProfile(context: UnpairContext): void {
  if (tvSessionMode(context.storage) !== "profile") return;
  leaveProfile(context, "switch", { serverEnded: true });
}

/**
 * Au démarrage à froid, AVANT que rien ne lise la session : une session de
 * profil qui ne se reprend pas (tout profil sauf celui retenu par « Ne plus
 * proposer à l'ouverture » — `coldStartProfile`, tv-core) est quittée — jeton
 * mis de côté pour révocation, données du profil effacées. L'app s'ouvre
 * alors sur « Qui regarde ? » : relancer l'app ne contourne jamais un PIN.
 */
export function leaveProfileAtBoot(storage: UnpairContext["storage"]): void {
  if (coldStartProfile(storage) === "leave") leaveSessionAtBoot(storage);
}

/** La sortie au démarrage : jeton mis de côté pour révocation, données du profil effacées. */
export function leaveSessionAtBoot(storage: UnpairContext["storage"]): void {
  beginProfileLeave(
    storage,
    { serverUrl: storage.getItem("tentacle_server_url"), token: storage.getItem("tentacle_token") },
    Date.now(),
  );
  wipeAccount(storage, PROFILE_STORAGE_KEYS);
  endWipe(storage);
}
