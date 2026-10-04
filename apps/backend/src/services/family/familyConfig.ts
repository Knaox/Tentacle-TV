import { getConfigValue, setConfigValue } from "../configStore";
import { getPrisma, hasPrisma } from "../db";
import { FAMILY_CONTRACT_VERSION, type FamilyCapability, type FamilySwitches } from "../../family/familyContract";
import { FamilyFailure } from "./familyErrors";

/**
 * Les deux interrupteurs de l'administration, dans `server_config` — ACTIVÉS
 * tant que l'administrateur ne les a pas coupés (clé absente = oui). Couper
 * « Familles » coupe membres ET invités ; « Profils invités », les invités
 * seuls. La session du propriétaire sur sa propre TV reste.
 */

export const FAMILY_ENABLED_KEY = "family_enabled";
export const FAMILY_GUESTS_KEY = "family_guests_enabled";

export function getFamilySwitches(): FamilySwitches {
  return {
    families: getConfigValue(FAMILY_ENABLED_KEY) !== "false",
    guests: getConfigValue(FAMILY_GUESTS_KEY) !== "false",
  };
}

/** `/api/config` › `features.family` : ce que le serveur sait faire, et permet. */
export function familyCapability(): FamilyCapability {
  const switches = getFamilySwitches();
  const guests = switches.families && switches.guests;
  return { v: FAMILY_CONTRACT_VERSION, enabled: switches.families, guests, guestRequests: guests };
}

export async function setFamilySwitches(patch: Partial<FamilySwitches>): Promise<FamilySwitches> {
  if (patch.families !== undefined) await setConfigValue(FAMILY_ENABLED_KEY, String(patch.families));
  if (patch.guests !== undefined) await setConfigValue(FAMILY_GUESTS_KEY, String(patch.guests));
  return getFamilySwitches();
}

/** Les gestes sur les membres exigent la Famille active. */
export function requireFamilies(): void {
  if (!getFamilySwitches().families) throw new FamilyFailure("family.disabled", "Familles coupées par l'administration");
}

/** Les gestes sur les invités exigent les deux interrupteurs. */
export function requireGuests(): void {
  requireFamilies();
  if (!getFamilySwitches().guests) throw new FamilyFailure("family.guests_disabled", "Profils invités coupés par l'administration");
}

// ── Le compte de démonstration de la revue Apple ─────────────────────────────

/**
 * Le compte que l'administration a désigné pour le provisionnement
 * (`provisioning_codes.jellyfinUserId`) — celui des relecteurs d'Apple. Il ne
 * crée RIEN chez Jellyfin : ses invités sont virtuels, il n'invite personne et
 * n'est jamais invité. Gardé une minute ; `forgetReviewAccount` après un
 * changement du provisionnement.
 */
const REVIEW_TTL_MS = 60_000;
/** Le compte du mode démonstration (`DEMO_MODE`), le cas échéant. */
const DEMO_USER_ID = "demo-user-001";
let reviewCache: { userId: string | null; expiresAt: number } | null = null;

async function reviewAccountId(): Promise<string | null> {
  const now = Date.now();
  if (reviewCache && reviewCache.expiresAt > now) return reviewCache.userId;
  if (!hasPrisma()) return null;
  try {
    const row = await getPrisma().provisioningCode.findFirst({ select: { jellyfinUserId: true } });
    reviewCache = { userId: row?.jellyfinUserId ?? null, expiresAt: now + REVIEW_TTL_MS };
  } catch {
    // Base muette : on garde la dernière réponse connue, sinon personne.
    return reviewCache?.userId ?? null;
  }
  return reviewCache.userId;
}

export async function isReviewAccount(userId: string): Promise<boolean> {
  if (userId === DEMO_USER_ID) return true;
  const reviewId = await reviewAccountId();
  return reviewId !== null && reviewId.replace(/-/g, "").toLowerCase() === userId.replace(/-/g, "").toLowerCase();
}

export function forgetReviewAccount(): void {
  reviewCache = null;
}

/** Le compte de démonstration ne fait AUCUN geste de propriétaire (SEC-F-28). */
export async function refuseReviewAccount(userId: string): Promise<void> {
  if (await isReviewAccount(userId)) {
    throw new FamilyFailure("family.review_account", "Compte de démonstration : aucun geste de propriétaire");
  }
}
