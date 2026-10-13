import { isPickerProfileLocked, type PickerProfileDto, type PickerProfilesDto } from "@tentacle-tv/shared";
import type { PickFlow } from "../pick/usePickFlow";
import type { PickerProfile, WhoIsWatchingModel } from "../picker/pickerTypes";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Ce que « Qui regarde ? » montre, tiré de la réponse du serveur et de l'état
 * du choix. Module pur (`pickerModel.test.ts`). SON profil passe en tête — le
 * serveur range la famille propriétaire, membres, invités ; un membre se
 * trouve donc d'abord, puis la famille dans l'ordre du serveur.
 */

export function orderedProfiles(profiles: readonly PickerProfileDto[]): PickerProfileDto[] {
  const own = profiles.filter((profile) => profile.personal);
  return [...own, ...profiles.filter((profile) => !profile.personal)];
}

export function pickerProfileOf(profile: PickerProfileDto, now: number, language: string, t: Translate): PickerProfile {
  const locked = isPickerProfileLocked(profile, now);
  const time = locked && profile.lockedUntil
    ? new Date(profile.lockedUntil).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })
    : null;
  return {
    id: profile.userId,
    name: profile.name,
    color: profile.color,
    imageTag: profile.imageTag,
    hasPin: profile.hasPin,
    guest: profile.kind === "guest",
    own: profile.personal,
    lockedLabel: time ? t("lockedUntil", { time }) : null,
  };
}

export interface PickerModelInput {
  listing: PickerProfilesDto | null;
  /** La liste n'a pas pu être lue, et aucune n'est connue. */
  error: string | null;
  flow: Pick<PickFlow, "pin" | "opening" | "notice">;
  /** Le dernier profil choisi : il reprend le focus quand le pavé se referme. */
  lastChosen?: string | null;
  /** « Ouverture de Léa… », quand le serveur tarde. */
  openingLabel: string | null;
  language: string;
  t: Translate;
  now?: number;
}

export function pickerModelOf(input: PickerModelInput): WhoIsWatchingModel {
  const { listing, flow, language, t } = input;
  const now = input.now ?? Date.now();
  if (flow.pin) {
    const { profile, entry, message } = flow.pin;
    return {
      kind: "pin",
      pad: { profile: pickerProfileOf(profile, now, language, t), typed: entry.digits.length, phase: entry.phase, message },
    };
  }
  if (!listing) return input.error ? { kind: "error", message: input.error } : { kind: "loading" };
  return {
    kind: "picker",
    profiles: orderedProfiles(listing.profiles).map((profile) => pickerProfileOf(profile, now, language, t)),
    canManage: listing.profiles.some((profile) => profile.personal),
    notice: flow.notice,
    entering: flow.opening ? { id: flow.opening, label: input.openingLabel } : null,
    focusId: input.lastChosen ?? null,
  };
}
