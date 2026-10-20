import type { FamilyProfileColor, FamilyProfileKind, FamilyRights, FamilySwitches } from "./familyContract";

/**
 * « Qui regarde ? » hors des TV — le CONTRAT du BUREAU (serveur 1.30.0,
 * capacité `family.desktopProfiles` ; la gestion depuis un profil :
 * `family.profileManage`). Le reste du contrat :
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
 *   Seule exception, comme sur les TV : le propriétaire ou un membre y GÈRE la
 *   famille avec ses droits, derrière SON PIN (`manage`).
 * - La déconnexion du compte sur cet appareil coupe ses sessions de profil.
 *
 * « Qui regarde ? » à l'ouverture se décide par APPAREIL (cet ordinateur :
 * « Ne plus proposer à la prochaine ouverture », gardé sur la machine), dans le
 * cadre que l'ADMINISTRATION règle plateforme par plateforme (1.30.0, capacité
 * `family.pickerPolicy`) : coupé pour tous (`off`), ou au choix de chaque
 * appareil, activé par défaut (`defaultOn`) chez qui n'a jamais choisi. Sans
 * objet sous deux profils. L'ancienne préférence du COMPTE
 * (`PickerPreferenceDto`) n'est plus lue que par les bureaux d'avant.
 */

/** Les plateformes où « Qui regarde ? » existe hors des TV — liste FERMÉE :
 *  le serveur refuse toute autre valeur (`family.invalid_input`). Le mobile
 *  (téléphone, tablette) depuis le serveur 1.31.1, capacité
 *  `family.mobileProfiles` : les MÊMES routes, les mêmes règles que le bureau
 *  (son hôte, ses sessions de profil — le serveur les appelle `desktopProfile`,
 *  nom interne de « session de profil hors TV »). Le mobile ne lit pas la
 *  politique d'ouverture du bureau (`launchPolicy`) : il retient le profil
 *  choisi sur l'appareil et ne redemande plus. Le WEB (le navigateur) depuis
 *  la 1.31.1, capacité `family.webProfiles` : les mêmes routes, la politique
 *  d'ouverture des ordinateurs (`launchPolicy`), et le jeton du compte mis en
 *  RÉSERVE par le serveur pendant un profil (cookie httpOnly, jamais lisible
 *  par la page : docs/FAMILLE.md, « Le web »). Un serveur d'avant refuse
 *  `web` : un navigateur n'y ouvre jamais un profil à moitié. */
export const FAMILY_PICKER_PLATFORMS = ["desktop", "mobile", "web"] as const;
export type FamilyPickerPlatform = (typeof FAMILY_PICKER_PLATFORMS)[number];

export function isPickerPlatform(value: unknown): value is FamilyPickerPlatform {
  return typeof value === "string" && (FAMILY_PICKER_PLATFORMS as readonly string[]).includes(value);
}

/** Les plateformes de l'ANCIENNE préférence du compte (`PickerPreferenceDto`),
 *  gardée pour les bureaux d'avant la 1.30.0 — le bureau seul : le mobile ne
 *  l'a jamais lue ni écrite. Liste FERMÉE. */
export const FAMILY_PICKER_PREFERENCE_PLATFORMS = ["desktop"] as const;
export type FamilyPickerPreferencePlatform = (typeof FAMILY_PICKER_PREFERENCE_PLATFORMS)[number];

/** Les plateformes que l'administration règle — liste FERMÉE : `desktop` (le
 *  bureau) et `tv` (Apple TV, Android TV). Les routes `/picker/*` restent
 *  celles du bureau (`FAMILY_PICKER_PLATFORMS`). */
export const FAMILY_LAUNCH_PLATFORMS = ["desktop", "tv"] as const;
export type FamilyLaunchPlatform = (typeof FAMILY_LAUNCH_PLATFORMS)[number];

/** `off` : coupé pour tous (jamais « Qui regarde ? » à l'ouverture sur cette
 *  plateforme) ; `choice` : chaque appareil en décide. */
export type FamilyLaunchMode = "off" | "choice";

/** Le bureau : `defaultOn`, ce que fait un ordinateur qui n'a jamais choisi. */
export interface FamilyDesktopLaunchPolicy {
  mode: FamilyLaunchMode;
  defaultOn: boolean;
}

/** Les TV : `off`, elles ouvrent directement le profil du compte qui les a
 *  jumelées, sans PIN ; `choice`, le comportement de toujours (« Qui regarde ? »,
 *  et « Ne plus proposer à l'ouverture », propre à chaque TV). */
export interface FamilyTvLaunchPolicy {
  mode: FamilyLaunchMode;
}

/** `GET` et `PUT /api/admin/family/picker` — la politique de l'administration.
 *  `desktop` et `tv` : sa forme d'avant, tirée de la forme simple (`enabled`,
 *  `platforms` : présents dès `family.launchPlatforms`). */
export interface FamilyLaunchPolicy {
  desktop: FamilyDesktopLaunchPolicy;
  tv: FamilyTvLaunchPolicy;
  enabled?: boolean;
  platforms?: FamilyLaunchPlatforms;
}

/** Sans réglage de l'administration : permis partout, le bureau activé par défaut. */
export const DEFAULT_FAMILY_LAUNCH_POLICY: Readonly<FamilyLaunchPolicy> = {
  desktop: { mode: "choice", defaultOn: true },
  tv: { mode: "choice" },
};

/** Le corps du `PUT` : seulement ce qui change. `desktop` et `tv` : la forme
 *  d'avant (un bureau d'avant la 1.31.1 l'envoie encore) ; `enabled` et
 *  `platforms` : la forme simple (`family.launchPlatforms`). */
export interface SetFamilyLaunchPolicyBody {
  desktop?: Partial<FamilyDesktopLaunchPolicy>;
  tv?: Partial<FamilyTvLaunchPolicy>;
  enabled?: boolean;
  platforms?: Partial<FamilyLaunchPlatforms>;
}

/**
 * « Qui regarde ? » à l'ouverture, réglé SIMPLEMENT (serveur 1.31.1, capacité
 * `family.launchPlatforms`) : un interrupteur général, puis les plateformes
 * cochées — liste FERMÉE, dans l'ordre de l'administration. Cochée : la
 * question s'affiche PAR DÉFAUT à l'ouverture de ses appareils, chacun gardant
 * sa case « Ne plus proposer » ; décochée (ou l'interrupteur coupé) : jamais
 * proposée d'office, « Changer de profil » reste. Pour les TV, décochée : elles
 * ouvrent directement le profil du compte qui les a jumelées (`askAtLaunch`).
 */
export const FAMILY_LAUNCH_ASK_PLATFORMS = ["desktop", "web", "mobile", "tv"] as const;
export type FamilyLaunchAskPlatform = (typeof FAMILY_LAUNCH_ASK_PLATFORMS)[number];
export type FamilyLaunchPlatforms = Record<FamilyLaunchAskPlatform, boolean>;

/** La forme simple de la politique, servie EN PLUS de `desktop` et `tv`. */
export interface FamilyLaunchSettings {
  enabled: boolean;
  platforms: FamilyLaunchPlatforms;
}

/** Serveur neuf, ou jamais réglé : allumé, tout coché — les TV comprises,
 *  comme avant (une TV ne s'ouvre jamais sans code à la mise à jour). */
export const DEFAULT_FAMILY_LAUNCH_SETTINGS: Readonly<FamilyLaunchSettings> = {
  enabled: true,
  platforms: { desktop: true, web: true, mobile: true, tv: true },
};

/** La question est-elle proposée d'office sur cette plateforme ? */
export function launchAskedOn(settings: FamilyLaunchSettings, platform: FamilyLaunchAskPlatform): boolean {
  return settings.enabled && settings.platforms[platform];
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
  /** Ce que la SESSION DE PROFIL de ce profil gère sur cet appareil
   *  (`family.profileManage`), « Gérer les profils » ouvert par SON PIN — les
   *  règles des TV (`TvProfileDto.manage`). Null : rien — un invité, le compte
   *  de démonstration, un profil sans code PIN. Absent : rien. */
  manage?: FamilyRights | null;
  /** Il gérerait s'il avait un code PIN (`TvProfileDto.manageNeedsPin`).
   *  Absent : faux. */
  manageNeedsPin?: boolean;
  /** 1.30.0 (`family.promptsReset`) : la photo est à reproposer depuis cette date (ISO,
   *  `FamilyProfileDto.promptsResetAt`). Null : jamais ; absent : serveur d'avant. */
  promptsResetAt?: string | null;
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
  /** Pour un bureau d'avant la 1.30.0 (qui y lisait la préférence du compte) :
   *  ce que fait un ordinateur qui n'a jamais choisi — permis ET activé par
   *  défaut. Un bureau à jour décide d'après `launchPolicy` et l'appareil. */
  atLaunch: boolean;
  /** Le cadre de l'administration pour le bureau (`family.pickerPolicy`).
   *  Absent (serveur d'avant) : permis, activé par défaut. Dès
   *  `family.launchPlatforms`, tiré de `launchAsk` pour la plateforme demandée
   *  (`choice` activé par défaut, ou `off`). */
  launchPolicy?: FamilyDesktopLaunchPolicy;
  /** 1.31.1 (`family.launchPlatforms`) : « Qui regarde ? » est proposé D'OFFICE
   *  à l'ouverture sur la plateforme demandée (interrupteur général allumé ET
   *  plateforme cochée). Faux : jamais d'office — ni question ni case « Ne plus
   *  proposer », « Changer de profil » reste. Absent : serveur d'avant. */
  launchAsk?: boolean;
}

/** `POST /api/family/picker/sessions` — avec le jeton PERSONNEL. */
export interface PickProfileBody {
  platform: FamilyPickerPlatform;
  profileId: string;
  /** Quatre chiffres, si le profil en a un — SON profil compris. */
  pin?: string;
  /** Le nom de cet appareil, montré par le tableau de bord de Jellyfin
   *  (`FAMILY_PICKER_DEVICE_NAME_MAX` caractères au plus) ; absent : « Desktop »
   *  (« Mobile » pour la plateforme `mobile`, « Web » pour `web`). */
  deviceName?: string;
}

/**
 * La réponse : `personal` — le compte lui-même, la session personnelle
 * reprend (la session de profil de cet appareil, s'il y en avait une, est
 * fermée) ; sinon une session de profil — son jeton devient celui de
 * l'application tant qu'elle dure (la précédente de cet appareil est fermée).
 */
export type PickedProfileDto =
  | {
      personal: true;
      profile: PickerProfileDto;
      /** Le web (`web`), de retour à son compte depuis la session d'un profil : le
       *  jeton de la session personnelle que le serveur gardait en réserve, rendu
       *  après SON code PIN — la page le reprend. Absent ailleurs. */
      token?: string;
    }
  | { personal: false; token: string; user: { id: string; name: string }; profile: PickerProfileDto };

/** `GET` et `PUT /api/family/picker/preference` — avec le jeton PERSONNEL. */
export interface PickerPreferenceDto {
  /** Par plateforme : l'ancienne préférence du COMPTE — plus lue par un bureau
   *  à jour (il décide par appareil : voir l'en-tête). */
  atLaunch: Record<FamilyPickerPreferencePlatform, boolean>;
}

export interface SetPickerPreferenceBody {
  platform: FamilyPickerPreferencePlatform;
  atLaunch: boolean;
}
