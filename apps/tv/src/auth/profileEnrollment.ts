import { enrollTvProfiles, resetSocketSession, setPreferencesToken } from "@tentacle-tv/api-client";
import type { FamilyCapability } from "@tentacle-tv/shared";
import {
  TV_ENROLL_PENDING_KEY,
  TV_PAIRING_TOKEN_KEY,
  findProfile,
  planProfileLaunch,
  tvSessionMode,
} from "@tentacle-tv/tv-core";
import { IS_TVOS } from "../storage/RNStorageAdapter";
import { loadProfiles, openProfile, refusalOfError } from "./profileOpening";
import { showProfiles } from "./profileSession";
import { notifySessionChanged } from "./sessionEvents";
import { unpairDevice, type UnpairContext } from "./unpair";

/**
 * L'ÉCHANGE — une Apple TV jumelée avant les profils passe aux profils, une
 * fois, quand son serveur annonce la Famille (`/api/config` ›
 * `features.family`). Serveur sans Famille : rien ne change, l'app est celle
 * d'avant. Android TV ne passe jamais aux profils. Séquence : docs/FAMILLE.md,
 * « L'échange ».
 *
 * L'ancien jeton ne vaut plus rien dès que le serveur a répondu : il quitte le
 * disque ET la mémoire d'un bloc, et n'est plus jamais présenté (il vaudrait
 * « révoqué » — l'app se déjumellerait). Une réponse perdue ne coûte pas un
 * rejumelage : le marqueur `TV_ENROLL_PENDING_KEY` fait rejouer l'échange
 * (que le serveur accepte tant que le nouveau jeton n'a pas servi) avant de
 * croire un « révoqué » (`sessionFlow.ts`).
 */

/** Seule l'Apple TV passe aux profils. */
export const PROFILES_ENABLED = IS_TVOS;

const CONFIG_TIMEOUT_MS = 4_000;

/** `features.family` du serveur ; null : un serveur d'avant la Famille ; `unreachable` : muet. */
export async function fetchFamilyCapability(serverUrl: string): Promise<FamilyCapability | null | "unreachable"> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);
  try {
    const res = await fetch(`${serverUrl.replace(/\/+$/, "")}/api/config`, { signal: controller.signal });
    if (!res.ok) return "unreachable";
    const config = (await res.json()) as { features?: { family?: FamilyCapability } };
    return config.features?.family ?? null;
  } catch {
    return "unreachable";
  } finally {
    clearTimeout(timer);
  }
}

export type EnrollOutcome = "enrolled" | "legacy" | "offline" | "unpaired" | "failed";

/** L'échange, si le serveur annonce la Famille et que la TV ne l'a pas encore fait. */
export async function enrollIfAnnounced(context: UnpairContext): Promise<EnrollOutcome> {
  if (!PROFILES_ENABLED || tvSessionMode(context.storage) !== "legacy") return "legacy";
  const serverUrl = context.storage.getItem("tentacle_server_url");
  if (!serverUrl) return "legacy";
  const capability = await fetchFamilyCapability(serverUrl);
  if (capability === "unreachable") return "offline";
  if (!capability) return "legacy";
  return enrollNow(context);
}

/** L'échange lui-même : la socket fermée d'abord, puis l'appel, puis le jeton de jumelage À LA PLACE de l'ancien. */
export async function enrollNow(context: UnpairContext): Promise<EnrollOutcome> {
  const { storage } = context;
  const serverUrl = storage.getItem("tentacle_server_url");
  const token = storage.getItem("tentacle_token");
  if (!PROFILES_ENABLED || !serverUrl || !token) return "legacy";
  resetSocketSession();
  storage.setItem(TV_ENROLL_PENDING_KEY, "1");
  try {
    const { pairingToken } = await enrollTvProfiles({ serverUrl, token });
    adoptPairing(context, pairingToken);
    return "enrolled";
  } catch (error) {
    const refusal = refusalOfError(error);
    if (refusal.kind === "offline") return "offline";
    // Un refus net : le serveur n'a rien appliqué, il n'y a rien à rejouer.
    storage.removeItem(TV_ENROLL_PENDING_KEY);
    if (refusal.kind === "unpaired") {
      unpairDevice(context, "revoked");
      return "unpaired";
    }
    return "failed";
  }
}

function adoptPairing({ jfClient, storage }: UnpairContext, pairingToken: string): void {
  storage.setItem(TV_PAIRING_TOKEN_KEY, pairingToken);
  storage.removeItem("tentacle_token");
  storage.removeItem(TV_ENROLL_PENDING_KEY);
  storage.removeItem("tentacle_jellyfin_token");
  storage.removeItem("tentacle_jellyfin_url");
  jfClient.setAccessToken(null);
  jfClient.setDirectStreaming(null);
  jfClient.adoptJellyfinDeviceId(null);
  jfClient.resetAuthState();
  setPreferencesToken(null);
  notifySessionChanged();
}

/**
 * Juste après l'échange (ou un jumelage neuf sur un serveur à Famille) : le
 * profil retenu s'ouvre (un jumelage refait, quand le serveur s'en souvient) ;
 * sinon « Qui regarde ? », même pour un profil seul. Rend vrai si une session
 * de profil est ouverte.
 */
export async function openOnLaunch(context: UnpairContext): Promise<boolean> {
  const loaded = await loadProfiles(context);
  if (!loaded.ok) {
    if (loaded.refusal.kind === "unpaired") {
      unpairDevice(context, "revoked");
      return false;
    }
    showProfiles("launch");
    return false;
  }
  const plan = planProfileLaunch(loaded.listing, "launch", Date.now());
  const profile = plan.kind === "open" ? findProfile(loaded.listing, plan.profileId) : null;
  if (plan.kind === "open" && profile) {
    const opened = await openProfile(context, loaded.listing, { profileId: profile.userId, remember: plan.remember, launch: plan.launch });
    if (opened.ok) return true;
  }
  showProfiles("launch");
  return false;
}

/**
 * Un « révoqué » sur l'ancien jeton alors qu'un échange est resté sans
 * réponse : l'échange a peut-être abouti. Rejoué, il rend le jeton de jumelage
 * et la TV continue ; refusé net, le « révoqué » était vrai (`failed` : à
 * l'appelant de déjumeler) ; serveur muet, on ne conclut rien. `none` : aucun
 * échange en suspens.
 */
export async function replayPendingEnrollment(context: UnpairContext): Promise<EnrollOutcome | "none"> {
  if (!PROFILES_ENABLED || !context.storage.getItem(TV_ENROLL_PENDING_KEY)) return "none";
  const outcome = await enrollNow(context);
  if (outcome === "enrolled") await openOnLaunch(context);
  return outcome;
}
