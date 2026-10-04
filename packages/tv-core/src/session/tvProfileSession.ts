import {
  isProfileColor,
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
  /** Le propriétaire de la TV (« Invité · famille de X »). */
  ownerId: string;
  ownerName: string;
  /** « Gérer les profils » existe sur cette TV (faux pour le compte de démonstration). */
  canManage: boolean;
}

const KINDS: readonly FamilyProfileKind[] = ["owner", "member", "guest"];
const LAUNCHES: readonly ProfileLaunch[] = ["sticky", "picked"];

/** Le profil ouvert, tel que la TV le retient. */
export function profileRecordOf(
  profile: TvProfileDto,
  listing: Pick<TvProfilesDto, "owner" | "canManage">,
  launch: ProfileLaunch,
): TvProfileRecord {
  return {
    profileId: profile.userId,
    name: profile.name,
    kind: profile.kind,
    color: profile.color,
    imageTag: profile.imageTag,
    hasPin: profile.hasPin,
    launch,
    ownerId: listing.owner.userId,
    ownerName: listing.owner.name,
    canManage: listing.canManage,
  };
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
    && typeof r.canManage === "boolean";
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
