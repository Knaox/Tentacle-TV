import { isProfileColor, type FamilyProfileKind, type TvProfilesDto } from "@tentacle-tv/shared";
import { pickerOrder, planProfileLaunch, type ProfileIntent } from "./profileLaunch";
import { TV_PROFILES_LISTING_KEY } from "./tvProfileKeys";
import type { SessionStorage } from "./unpairJournal";

/**
 * La dernière liste de « Qui regarde ? », gardée sur l'appareil : au
 * lancement, la rangée des profils paraît AVANT toute attente réseau, puis se
 * relit en fond (`useProfilesFlow`). Le serveur reste juge de tout : ouvrir un
 * profil disparu, ou dont le PIN a changé, se refuse comme d'habitude, et la
 * rangée se relit. Module pur, stockage injecté.
 */

const KINDS: readonly FamilyProfileKind[] = ["owner", "member", "guest"];

function isAccount(value: unknown): value is { userId: string; name: string } {
  const r = value as Record<string, unknown> | null;
  return !!r && typeof r.userId === "string" && typeof r.name === "string";
}

function isProfile(value: unknown): boolean {
  const r = value as Record<string, unknown> | null;
  return !!r
    && typeof r.userId === "string" && r.userId !== ""
    && typeof r.name === "string"
    && KINDS.includes(r.kind as FamilyProfileKind)
    && isProfileColor(r.color)
    && typeof r.hasPin === "boolean"
    && (r.imageTag === null || typeof r.imageTag === "string")
    && (r.lockedUntil === null || typeof r.lockedUntil === "string");
}

function isListing(value: unknown): value is TvProfilesDto {
  const r = value as Record<string, unknown> | null;
  return !!r
    && Array.isArray(r.profiles) && r.profiles.length > 0 && r.profiles.every(isProfile)
    && isAccount(r.owner)
    && (r.pairedBy === undefined || isAccount(r.pairedBy))
    && (r.stickyProfileId === null || typeof r.stickyProfileId === "string")
    && typeof r.canManage === "boolean";
}

/** La liste gardée ; illisible, vide ou d'une forme inconnue : aucune (la rangée attend le serveur). */
export function readCachedProfiles(storage: SessionStorage): TvProfilesDto | null {
  const raw = storage.getItem(TV_PROFILES_LISTING_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isListing(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function cacheProfiles(storage: SessionStorage, listing: TvProfilesDto): void {
  storage.setItem(TV_PROFILES_LISTING_KEY, JSON.stringify(listing));
}

/**
 * La rangée à montrer AUSSITÔT à l'arrivée sur « Qui regarde ? », d'après la
 * liste gardée — dans l'ordre de la rangée (`pickerOrder`). Null quand rien
 * n'est gardé, ou quand la liste dit qu'un profil s'ouvrirait seul (retenu,
 * compte seul) : la rangée ne paraît pas pour disparaître aussitôt, la TV
 * attend le serveur.
 */
export function cachedPicker(storage: SessionStorage, intent: ProfileIntent, now: number): TvProfilesDto | null {
  const cached = readCachedProfiles(storage);
  if (!cached || planProfileLaunch(cached, intent, now).kind !== "picker") return null;
  return pickerOrder(cached);
}
