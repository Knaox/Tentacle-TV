import type { FamilyProfileColor, FamilyOverviewDto } from "./familyContract";
import type { PickerProfilesDto } from "./familyPickerContract";
import { sameUserId } from "./familyRules";

/**
 * La COULEUR du rond d'un profil sans photo, la MÊME partout (en-tête, page
 * Profil, « Qui regarde ? », Famille, « Changer de profil ») — celle que le
 * serveur donne au profil (`FamilyProfileColor`). Module pur, partagé par le
 * web, le bureau et le mobile : `familyFaceColor.test.ts`.
 *
 * - Session d'un profil : la sienne.
 * - Session personnelle dans une famille d'au moins deux profils : celle du
 *   profil du compte, lue dans « Qui regarde ? », sinon dans la Famille.
 * - Sinon (pas de famille, serveur d'avant) : null — le dégradé de marque.
 */

/** La couleur du profil du compte, s'il y a une famille à montrer (deux profils au moins). */
export function personalColorOf(
  listing: Pick<PickerProfilesDto, "pickerRequired" | "profiles"> | null | undefined,
): FamilyProfileColor | null {
  if (!listing?.pickerRequired) return null;
  return listing.profiles.find((profile) => profile.personal)?.color ?? null;
}

/** La couleur du compte dans SA famille (`GET /api/family`), si elle compte au moins deux profils. */
export function overviewColorOf(overview: Pick<FamilyOverviewDto, "family"> | null | undefined, accountId: string | null): FamilyProfileColor | null {
  const profiles = overview?.family?.profiles ?? [];
  if (!accountId || profiles.length < 2) return null;
  return profiles.find((profile) => sameUserId(profile.userId, accountId))?.color ?? null;
}

export interface FaceColorInput {
  /** La couleur du profil de la session de profil en cours, ou null (session personnelle). */
  activeColor: FamilyProfileColor | null;
  listing?: Pick<PickerProfilesDto, "pickerRequired" | "profiles"> | null;
  overview?: Pick<FamilyOverviewDto, "family"> | null;
  accountId: string | null;
}

export function faceColorOf(input: FaceColorInput): FamilyProfileColor | null {
  if (input.activeColor) return input.activeColor;
  return personalColorOf(input.listing) ?? overviewColorOf(input.overview, input.accountId);
}
