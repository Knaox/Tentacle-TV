import type { TFunction } from "i18next";
import { familyErrorKey, type TvProfileDto } from "@tentacle-tv/shared";
import { isProfileLocked, type PinEntry, type ProfileRefusal } from "@tentacle-tv/tv-core";
import type { ProfileTileModel } from "../../redesign/screens/profiles/ProfilesView";

/**
 * Ce que « Qui regarde ? » montre d'un profil et d'un refus, résolu pour la
 * vue : portrait, blocage et son heure, messages du pavé.
 */

/** Le portrait Jellyfin d'un profil, par le proxy du serveur — il se lit sans jeton. */
export function profileAvatarUri(serverUrl: string | null, userId: string, imageTag: string | null, size = 400): string | undefined {
  if (!serverUrl || !imageTag) return undefined;
  const base = serverUrl.replace(/\/+$/, "");
  return `${base}/api/jellyfin/Users/${encodeURIComponent(userId)}/Images/Primary?tag=${encodeURIComponent(imageTag)}&maxWidth=${size}&quality=90`;
}

/** L'heure de fin d'un blocage : l'heure seule le jour même, le jour en plus au-delà. */
export function formatUnlockTime(iso: string, language: string, now: number): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "—";
  const time = at.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });
  if (new Date(now).toDateString() === at.toDateString()) return time;
  return `${at.toLocaleDateString(language, { weekday: "long" })} ${time}`;
}

export function tileModelOf(profile: TvProfileDto, serverUrl: string | null, now: number, language: string, t: TFunction): ProfileTileModel {
  const locked = isProfileLocked(profile, now) && profile.lockedUntil;
  return {
    id: profile.userId,
    name: profile.name,
    color: profile.color,
    avatarUri: profileAvatarUri(serverUrl, profile.userId, profile.imageTag),
    hasPin: profile.hasPin,
    guest: profile.kind === "guest",
    lockedLabel: locked ? t("familyTv:lockedUntil", { time: formatUnlockTime(locked, language, now) }) : null,
  };
}

/** La ligne du pavé : un code faux et ses essais restants, ou le blocage et son heure. */
export function pinMessageOf(entry: PinEntry, language: string, now: number, t: TFunction): string | null {
  if (entry.phase === "wrong") return t("familyTv:pin.wrong", { count: entry.attemptsLeft ?? 0 });
  if (entry.phase === "locked") {
    return t("familyTv:pin.locked", { time: entry.lockedUntil ? formatUnlockTime(entry.lockedUntil, language, now) : "—" });
  }
  return null;
}

/** La phrase d'un refus, sur « Qui regarde ? » ou dans la gestion. */
export function refusalMessage(refusal: ProfileRefusal, t: TFunction): string {
  switch (refusal.kind) {
    case "offline":
      return t("familyTv:offline");
    case "unavailable":
      return t("familyTv:unavailable");
    case "disabled":
      return t(refusal.code === "family.guests_disabled" ? "familyTv:guestsDisabled" : "familyTv:disabled");
    case "failed":
      return refusal.code ? t(familyErrorKey(refusal.code)) : t("familyTv:loadFailed");
    case "locked":
    case "pinInvalid":
    case "pinRequired":
      return t("family:errors.pin_required");
    default:
      return t("familyTv:loadFailed");
  }
}
