import type { FamilyProfileColor, FamilyProfileKind, FamilySwitches } from "./familyContract";

/**
 * « Qui regarde ? » hors des TV — le CONTRAT du BUREAU (serveur 1.30.0,
 * capacité `family.desktopProfiles`). Le reste du contrat :
 * `familyContract.ts` ; les TV : `familyTvContract.ts` ; carnet :
 * docs/FAMILLE.md, « Le bureau ».
 *
 * MIROIR : `apps/backend/src/family/familyPickerContract.ts`, octet pour octet
 * (voir l'en-tête de `familyContract.ts`).
 *
 * Sur le bureau, la SESSION PERSONNELLE (le jeton Jellyfin du compte) reste la
 * racine : c'est elle, et elle seule, qui liste les profils et en choisit un.
 * - Choisir SON profil, c'est continuer avec elle — droits complets,
 *   administration comprise — APRÈS son PIN s'il en a un (vérifié par le
 *   serveur : même compteur par profil, même blocage que sur les TV).
 * - Choisir un AUTRE profil de la famille (propriétaire, membre, invité :
 *   celle du compte, comme sur sa TV) ouvre une SESSION DE PROFIL délivrée par
 *   le serveur, aux règles des TV : un jeton d'appareil au nom du profil qui
 *   REGARDE et n'administre rien, une seule par appareil, coupée par tout
 *   retrait. Elle ne reçoit jamais de jeton Jellyfin : tout passe par Tentacle.
 * - La déconnexion du compte sur cet appareil coupe ses sessions de profil.
 *
 * « Qui regarde ? » au lancement est une préférence du COMPTE, par PLATEFORME
 * (liste FERMÉE), DÉSACTIVÉE par défaut : activée sur un ordinateur, elle vaut
 * pour tous les ordinateurs de ce compte. Sans objet sous deux profils.
 */

/** Les plateformes où « Qui regarde ? » existe hors des TV — liste FERMÉE :
 *  le serveur refuse toute autre valeur (`family.invalid_input`). Le web et le
 *  mobile pourront suivre, chacun avec sa capacité. */
export const FAMILY_PICKER_PLATFORMS = ["desktop"] as const;
export type FamilyPickerPlatform = (typeof FAMILY_PICKER_PLATFORMS)[number];

export function isPickerPlatform(value: unknown): value is FamilyPickerPlatform {
  return typeof value === "string" && (FAMILY_PICKER_PLATFORMS as readonly string[]).includes(value);
}

/** Le nom d'appareil qu'un client peut donner (tableau de bord de Jellyfin). */
export const FAMILY_PICKER_DEVICE_NAME_MAX = 64;

/** Un profil de « Qui regarde ? », tel que le bureau le montre. */
export interface PickerProfileDto {
  /** L'identifiant du profil : son compte Jellyfin. */
  userId: string;
  /** Le rôle du profil dans la famille. */
  kind: FamilyProfileKind;
  name: string;
  color: FamilyProfileColor;
  /** Un PIN protège ce profil : le choisir le demande. */
  hasPin: boolean;
  /** L'avatar Jellyfin (`PrimaryImageTag`) ; null sans photo (un invité a la sienne depuis la 1.30.0). */
  imageTag: string | null;
  /** Trop d'essais ratés (tous appareils confondus) : bloqué jusqu'à (ISO). */
  lockedUntil: string | null;
  /** Un invité : le compte qui l'a créé ; null sinon. */
  createdBy: string | null;
  /** Le profil du COMPTE de la session personnelle : le choisir revient à elle
   *  (après son PIN), jamais une session de profil. Un seul par liste. */
  personal: boolean;
  /** Un invité dont le compte de la session personnelle peut changer la photo
   *  (`setGuestPhoto` : son propriétaire, ou le membre qui l'a créé) — pendant
   *  sa session de profil, l'appareil l'habille par la session personnelle.
   *  Absent d'un serveur d'avant la 1.30.0. */
  photoEditable?: boolean;
}

/** `GET /api/family/picker/profiles?platform=desktop` — avec le jeton PERSONNEL. */
export interface PickerProfilesDto {
  v: number;
  platform: FamilyPickerPlatform;
  switches: FamilySwitches;
  /** Le compte de la session personnelle. */
  account: { userId: string; name: string };
  /** La famille du compte, comme sur sa TV : le propriétaire en tête, puis
   *  les membres, puis les invités (chacun par ordre d'arrivée) ; le seul
   *  compte s'il n'est dans aucune famille, ou la Famille coupée. */
  profiles: PickerProfileDto[];
  /** Le profil en cours sur CET appareil d'après le serveur : celui de sa
   *  session de profil ouverte, sinon le compte. */
  currentProfileId: string;
  /** Vrai dès deux profils : sinon « Qui regarde ? » est sans objet. */
  pickerRequired: boolean;
  /** La préférence du compte pour cette plateforme : « Qui regarde ? » au lancement. */
  atLaunch: boolean;
}

/** `POST /api/family/picker/sessions` — avec le jeton PERSONNEL. */
export interface PickProfileBody {
  platform: FamilyPickerPlatform;
  profileId: string;
  /** Quatre chiffres, si le profil en a un — SON profil compris. */
  pin?: string;
  /** Le nom de cet appareil, montré par le tableau de bord de Jellyfin
   *  (`FAMILY_PICKER_DEVICE_NAME_MAX` caractères au plus) ; absent : « Desktop ». */
  deviceName?: string;
}

/**
 * La réponse : `personal` — le compte lui-même, la session personnelle
 * reprend (la session de profil de cet appareil, s'il y en avait une, est
 * fermée) ; sinon une session de profil — son jeton devient celui de
 * l'application tant qu'elle dure (la précédente de cet appareil est fermée).
 */
export type PickedProfileDto =
  | { personal: true; profile: PickerProfileDto }
  | { personal: false; token: string; user: { id: string; name: string }; profile: PickerProfileDto };

/** `GET` et `PUT /api/family/picker/preference` — avec le jeton PERSONNEL. */
export interface PickerPreferenceDto {
  /** Par plateforme : « Qui regarde ? » au lancement (désactivé par défaut). */
  atLaunch: Record<FamilyPickerPlatform, boolean>;
}

export interface SetPickerPreferenceBody {
  platform: FamilyPickerPlatform;
  atLaunch: boolean;
}
