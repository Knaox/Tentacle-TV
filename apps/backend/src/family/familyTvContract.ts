import type { FamilyProfileColor, FamilyProfileKind, FamilyRights, FamilySwitches } from "./familyContract";

/**
 * La Famille sur l'Apple TV — le CONTRAT des TV (v2). Le reste du contrat :
 * `familyContract.ts`.
 *
 * MIROIR : `apps/backend/src/family/familyTvContract.ts`, octet pour octet
 * (voir l'en-tête de `familyContract.ts`).
 *
 * Une TV montre la famille du compte qui l'a JUMELÉE, qu'il en soit le
 * propriétaire ou un membre : toute la famille — propriétaire, membres et
 * invités. Ouvrir un profil y suit partout les mêmes règles (PIN compté par
 * profil toutes TV confondues, blocages, révocations).
 */

/** `POST /api/family/tv/enroll` : le jeton de jumelage « profils seuls » qui
 *  REMPLACE celui de la TV. L'ancien ne vaut plus rien ailleurs. */
export interface TvEnrollResponse {
  pairingToken: string;
}

export interface TvProfileDto {
  userId: string;
  kind: FamilyProfileKind;
  name: string;
  color: FamilyProfileColor;
  hasPin: boolean;
  imageTag: string | null;
  /** Trop d'essais ratés (toutes TV confondues) : bloqué jusqu'à (ISO). */
  lockedUntil: string | null;
  /** Un invité : le compte qui l'a créé ; null sinon. */
  createdBy: string | null;
  /** Ce que CE profil gérerait sur cette TV (« Gérer les profils », derrière
   *  SON PIN) ; null : rien à y gérer — un invité, le compte de démonstration. */
  manage: FamilyRights | null;
}

/** `GET /api/family/tv/profiles` — « Qui regarde ? ». */
export interface TvProfilesDto {
  v: number;
  switches: FamilySwitches;
  /** Le compte qui a jumelé cette TV : le propriétaire de la famille OU l'un
   *  de ses membres (pas forcément en tête de `profiles`). */
  pairedBy: { userId: string; name: string };
  /** @deprecated v1 — `pairedBy` (même valeur). */
  owner: { userId: string; name: string };
  /** Toute la famille : le propriétaire en tête, puis les membres, puis les
   *  invités ; le seul compte de la TV s'il n'est dans aucune famille. */
  profiles: TvProfileDto[];
  /** « Rester sur ce profil » : la TV l'ouvre au lancement, sans PIN. */
  stickyProfileId: string | null;
  /** Vrai dès deux profils : sinon la TV ouvre directement le seul. */
  pickerRequired: boolean;
  /** « Gérer les profils » existe sur cette TV : au moins un profil y a quelque
   *  chose à gérer (`manage`). Faux pour le compte de démonstration, qui ne
   *  crée rien : la TV n'en montre pas l'entrée. */
  canManage: boolean;
}

export interface OpenTvSessionBody {
  profileId: string;
  /** Quatre chiffres, si le profil en a un (sauf profil « Rester » de cette TV). */
  pin?: string;
  /** « Rester sur ce profil » : vrai le pose, faux l'ôte (absent : faux). */
  remember?: boolean;
}

/** Une session de profil : un jeton d'appareil comme ceux du jumelage, au nom
 *  du profil, qui ne vaut que sur cette TV et cesse à tout retrait. */
export interface TvSessionDto {
  token: string;
  user: { id: string; name: string };
  profile: TvProfileDto;
  remembered: boolean;
}

/** `tvManageUnlock` : le PIN du profil de la session (propriétaire ou membre). */
export interface ManageUnlockBody {
  pin?: string;
}

export interface ManageUnlockResponse {
  unlockedUntil: string;
  /** Ce que cette session peut gérer : les droits de SON profil, pas plus. */
  rights: FamilyRights;
}
