import {
  isProfileColor,
  sameUserId,
  type FamilyGuestRights,
  type FamilyProfileColor,
  type FamilyProfileKind,
  type TvProfileDto,
  type TvProfilesDto,
} from "@tentacle-tv/shared";
import { TV_PAIRING_TOKEN_KEY, TV_PROFILE_KEY } from "./tvProfileKeys";
import type { SessionStorage } from "./unpairJournal";

/**
 * La SESSION DE PROFIL d'une Apple TV passée aux profils (Famille) : ce que la
 * TV retient du profil ouvert, et l'état de sa session. Module pur, stockage
 * injecté. Séquence : docs/FAMILLE.md, « La séquence de l'Apple TV ».
 *
 * Le jeton de la session vit dans `tentacle_token` (LE jeton de l'app) ; ce
 * qui le DÉCRIT vit à côté (`TV_PROFILE_KEY`) et part avec lui
 * (`PROFILE_STORAGE_KEYS`). Rien ici n'accorde un droit : le serveur décide de
 * tout (PIN, profils ouvrables, gestion) ; la TV ne fait que s'en souvenir
 * pour ses écrans et pour son démarrage.
 */

/** Comment la session s'est ouverte — c'est ce qui dit si un démarrage à froid la reprend :
 *  `sticky` (« Ne plus proposer à l'ouverture »), `picked` (choisie dans « Qui regarde ? »).
 *  ⚠️ Écrit sur le disque : une valeur d'avant (`single`, le seul profil
 *  ouvert d'office) rend l'enregistrement illisible — la session est quittée
 *  au démarrage, et « Qui regarde ? » s'affiche. */
export type ProfileLaunch = "sticky" | "picked";

export interface TvProfileRecord {
  profileId: string;
  name: string;
  kind: FamilyProfileKind;
  color: FamilyProfileColor;
  /** L'avatar Jellyfin ; null pour un invité. */
  imageTag: string | null;
  hasPin: boolean;
  launch: ProfileLaunch;
  /** Le compte qui a JUMELÉ la TV (`pairedBy` ; v1 : son propriétaire) — seul
   *  son profil la déjumelle. ⚠️ Noms rangés sur le disque : ne pas renommer. */
  ownerId: string;
  ownerName: string;
  /** v1 : « Gérer les profils » existe sur cette TV. Relu par `recordManages` pour un enregistrement d'avant. */
  canManage: boolean;
  /** Le propriétaire de la FAMILLE (« Membre · famille de X ») — v2 : pas
   *  forcément celui de la TV. Absent d'un enregistrement d'avant : `ownerName`. */
  familyOwnerName?: string;
  /** CE profil gère quelque chose sur cette TV (`manage` du serveur, v2). Absent d'un enregistrement d'avant. */
  manages?: boolean;
  /** Un invité : ses droits à l'ouverture (« peut demander », v2) ; la garde
   *  de Vigie préfère la liste relue (`profileMayRequest`). Absent : aucun. */
  guestRights?: FamilyGuestRights | null;
}

const KINDS: readonly FamilyProfileKind[] = ["owner", "member", "guest"];
const LAUNCHES: readonly ProfileLaunch[] = ["sticky", "picked"];

/** Ce que `profileRecordOf` lit de « Qui regarde ? » (v1 : `owner` seul, ni `pairedBy` ni `manage`). */
export type ProfilesListingRef = Pick<TvProfilesDto, "owner" | "canManage"> & Partial<Pick<TvProfilesDto, "pairedBy" | "profiles">>;

/** Le compte qui a jumelé la TV : `pairedBy` (v2), sinon `owner` (v1, même valeur). */
export function pairedAccountOf(listing: Pick<TvProfilesDto, "owner"> & Partial<Pick<TvProfilesDto, "pairedBy">>): { userId: string; name: string } {
  return listing.pairedBy ?? listing.owner;
}

/**
 * CE profil a-t-il quelque chose à gérer sur cette TV (« Gérer les profils »,
 * derrière SON PIN) ? v2 : son `manage` (nul pour un invité, le compte de
 * démonstration) ; v1 (sans `manage`) : le propriétaire seul.
 */
export function profileManages(profile: TvProfileDto, listing: Pick<TvProfilesDto, "canManage">): boolean {
  if ("manage" in profile && profile.manage !== undefined) return profile.manage !== null;
  return profile.kind === "owner" && listing.canManage;
}

/** Le profil ouvert, tel que la TV le retient. */
export function profileRecordOf(profile: TvProfileDto, listing: ProfilesListingRef, launch: ProfileLaunch): TvProfileRecord {
  const paired = pairedAccountOf(listing);
  const familyOwner = listing.profiles?.find((candidate) => candidate.kind === "owner");
  return {
    profileId: profile.userId,
    name: profile.name,
    kind: profile.kind,
    color: profile.color,
    imageTag: profile.imageTag,
    hasPin: profile.hasPin,
    launch,
    ownerId: paired.userId,
    ownerName: paired.name,
    canManage: listing.canManage,
    familyOwnerName: familyOwner?.name ?? paired.name,
    manages: profileManages(profile, listing),
    guestRights: profile.guestRights ?? null,
  };
}

/** « Gérer les profils » dans les réglages du profil ouvert. Un enregistrement d'avant : le propriétaire, si la TV le permettait. */
export function recordManages(record: TvProfileRecord): boolean {
  return record.manages ?? (record.kind === "owner" && record.canManage);
}

/** Le profil ouvert est celui du compte qui a jumelé la TV : lui seul la déjumelle. */
export function recordPairedTheTv(record: TvProfileRecord): boolean {
  return sameUserId(record.profileId, record.ownerId);
}

function isRecord(value: unknown): value is TvProfileRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return typeof r.profileId === "string" && r.profileId !== ""
    && typeof r.name === "string"
    && KINDS.includes(r.kind as FamilyProfileKind)
    && isProfileColor(r.color)
    && (r.imageTag === null || typeof r.imageTag === "string")
    && typeof r.hasPin === "boolean"
    && LAUNCHES.includes(r.launch as ProfileLaunch)
    && typeof r.ownerId === "string"
    && typeof r.ownerName === "string"
    && typeof r.canManage === "boolean"
    && (r.familyOwnerName === undefined || typeof r.familyOwnerName === "string")
    && (r.manages === undefined || typeof r.manages === "boolean")
    && (r.guestRights === undefined || r.guestRights === null || typeof (r.guestRights as { requestTitles?: unknown }).requestTitles === "boolean");
}

/** Le profil retenu ; illisible ou incomplet : aucun (la session ne se reprend pas). */
export function readProfileRecord(storage: SessionStorage): TvProfileRecord | null {
  const raw = storage.getItem(TV_PROFILE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeProfileRecord(storage: SessionStorage, record: TvProfileRecord): void {
  storage.setItem(TV_PROFILE_KEY, JSON.stringify(record));
}

/**
 * L'état de la session d'un téléviseur :
 * - `unpaired` : à jumeler ;
 * - `legacy` : un jumelage d'avant les profils (serveur sans Famille, ou pas
 *   encore échangé) — l'app d'avant, telle quelle ;
 * - `choosing` : jumelée, passée aux profils, aucun profil ouvert — « Qui
 *   regarde ? » ;
 * - `profile` : un profil ouvert.
 * Un jeton de session sans son profil retenu ne vaut pas session : il est à
 * quitter (`coldStartProfile`).
 */
export type TvSessionMode = "unpaired" | "legacy" | "choosing" | "profile";

export function tvSessionMode(storage: SessionStorage): TvSessionMode {
  const token = storage.getItem("tentacle_token");
  if (storage.getItem(TV_PAIRING_TOKEN_KEY)) return token && readProfileRecord(storage) ? "profile" : "choosing";
  return token ? "legacy" : "unpaired";
}

/** Une TV passée aux profils (jeton de jumelage « profils seuls » en main). */
export function hasProfilePairing(storage: SessionStorage): boolean {
  return !!storage.getItem(TV_PAIRING_TOKEN_KEY);
}

/**
 * Au démarrage à froid, la session de profil d'avant se REPREND-elle ? Seulement
 * celle du profil retenu (« Ne plus proposer à l'ouverture »). Toute autre
 * repasse par « Qui regarde ? » — et par le PIN : relancer l'app ne doit
 * jamais contourner un code.
 */
export function resumesOnLaunch(record: TvProfileRecord | null): boolean {
  return record?.launch === "sticky";
}

/**
 * Ce que le démarrage à froid fait de la session trouvée : `resume` (on la
 * garde), `leave` (on la quitte avant que rien ne la lise : jeton mis de côté
 * pour révocation, données du profil effacées), `none` (pas de session de
 * profil — jumelage d'avant, ou rien).
 */
export function coldStartProfile(storage: SessionStorage): "resume" | "leave" | "none" {
  if (!hasProfilePairing(storage)) return "none";
  if (!storage.getItem("tentacle_token")) return "none";
  return resumesOnLaunch(readProfileRecord(storage)) ? "resume" : "leave";
}
