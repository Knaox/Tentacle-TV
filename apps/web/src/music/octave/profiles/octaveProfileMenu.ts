import { sameUserId, type PickerProfileDto, type PickerProfilesDto } from "@tentacle-tv/shared";
import { manageTarget, switchActiveId } from "../../../profiles/switcher/switchPlan";

/**
 * Octave — ce que le menu du profil de la coquille offre, tiré de la liste de
 * « Qui regarde ? » (module pur, `octaveProfileMenu.test.ts`). Les MÊMES
 * règles que l'entrée « Changer de profil » du menu de l'avatar de Tentacle
 * (`useProfileMenuItems`) et que « Qui regarde ? » (`switchPlan.ts`) :
 *
 * - rien face à un serveur sans la capacité de cette coquille ou sans la
 *   Famille (`enabled`), hors ligne (changer de profil passe par le serveur),
 *   ni pour une famille d'un seul profil ou qui ne demande pas qui regarde ;
 * - le profil ACTUEL : celui de la session de profil, sinon son propre profil ;
 * - « Gérer les profils » : là où « Qui regarde ? » l'offre (`manageTarget` :
 *   la session personnelle, ou un profil qui gère).
 */

export interface OctaveProfileMenuInput {
  listing: PickerProfilesDto | null | undefined;
  /** La requête de la liste a le droit de partir (capacité, Famille, compte). */
  enabled: boolean;
  offline: boolean;
  /** Le profil de la session de profil en cours ; null : la session personnelle. */
  activeProfileId: string | null;
}

export interface OctaveProfileMenu {
  current: PickerProfileDto | null;
  profiles: readonly PickerProfileDto[];
  canManage: boolean;
}

export function octaveProfileMenu({ listing, enabled, offline, activeProfileId }: OctaveProfileMenuInput): OctaveProfileMenu | null {
  if (!enabled || offline || !listing || listing.pickerRequired !== true || listing.profiles.length < 2) return null;
  const currentId = switchActiveId(listing.profiles, activeProfileId);
  return {
    current: currentId === null ? null : listing.profiles.find((profile) => sameUserId(profile.userId, currentId)) ?? null,
    profiles: listing.profiles,
    canManage: manageTarget(listing.profiles, activeProfileId) !== null,
  };
}
