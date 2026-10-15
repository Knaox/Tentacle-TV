import { normalizeJellyfinId } from "../../userRights/userRightsPatch";
import type { JellyfinPolicy } from "../userRights/policyMapping";

/**
 * Les BIBLIOTHÈQUES qu'une famille permet à un invité ou à un membre mineur —
 * règles pures (docs/DROITS-UTILISATEURS.md § 9.8). Jellyfin applique : la
 * politique du profil porte `EnableAllFolders` / `EnabledFolders`, l'intersection
 * du PLAFOND (les bibliothèques de son créateur pour un invité, sa base — celles
 * que règle l'administrateur — pour un membre) et de la liste VOULUE par la
 * famille (null : toutes celles du plafond).
 *
 * L'administrateur prime : jamais plus large que le plafond. Un plafond qui ne
 * recoupe plus rien de la liste voulue donne AUCUNE bibliothèque — rien ne
 * s'élargit en silence.
 */

/** Les deux champs de Jellyfin, tels quels : rendus à l'identique au retrait. */
export interface LibraryAccess {
  all: boolean;
  ids: string[];
}

/** La liste voulue par la famille : null = toutes celles du plafond. */
export type WantedLibraries = string[] | null;

/** Plus de bibliothèques que n'en a un serveur réel : au-delà, le corps est refusé. */
export const FAMILY_LIBRARIES_MAX = 200;

function sameId(a: string, b: string): boolean {
  return normalizeJellyfinId(a) === normalizeJellyfinId(b);
}

function sameIdSet(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a.map(normalizeJellyfinId));
  const right = new Set(b.map(normalizeJellyfinId));
  return left.size === right.size && [...left].every((id) => right.has(id));
}

/** Les bibliothèques d'une politique ; absent ou illisible : aucune (le plus fermé). */
export function libraryAccessOfPolicy(policy: JellyfinPolicy): LibraryAccess {
  const ids = Array.isArray(policy.EnabledFolders) ? policy.EnabledFolders.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
  return { all: policy.EnableAllFolders === true, ids };
}

/** Deux accès disent-ils la même chose ? (identifiants sans tirets ni casse, sans ordre) */
export function sameLibraryAccess(a: LibraryAccess, b: LibraryAccess): boolean {
  return a.all === b.all && sameIdSet(a.ids, b.ids);
}

/** Une bibliothèque passe-t-elle ce plafond ? */
export function withinLibraryAccess(access: LibraryAccess, id: string): boolean {
  return access.all || access.ids.some((entry) => sameId(entry, id));
}

/** Ce que Jellyfin doit porter : le plafond, recoupé avec la liste voulue (jamais plus large). */
export function effectiveLibraryAccess(ceiling: LibraryAccess, wanted: WantedLibraries): LibraryAccess {
  if (wanted === null) return { all: ceiling.all, ids: [...ceiling.ids] };
  return { all: false, ids: wanted.filter((id) => withinLibraryAccess(ceiling, id)) };
}

/** Pose ces bibliothèques sur une politique ; le reste repart à l'octet près. */
export function withLibraryAccess(policy: JellyfinPolicy, access: LibraryAccess): JellyfinPolicy {
  return { ...policy, EnableAllFolders: access.all, EnabledFolders: [...access.ids] };
}

/**
 * La base mise à jour d'après la politique LUE : si elle diffère de la dernière
 * écriture, l'accès a été changé AILLEURS (l'administrateur, par Tentacle ou dans
 * Jellyfin) — il devient la base, et c'est lui qui sera rendu au départ.
 */
export function rebaseLibraryAccess(base: LibraryAccess, previous: LibraryAccess, current: LibraryAccess): LibraryAccess {
  return sameLibraryAccess(current, previous) ? base : { all: current.all, ids: [...current.ids] };
}

/** Les bibliothèques du serveur que ce plafond laisse voir, dans l'ordre du serveur. */
export function librariesWithin<T extends { id: string }>(libraries: readonly T[], ceiling: LibraryAccess): T[] {
  return libraries.filter((library) => withinLibraryAccess(ceiling, library.id));
}

/**
 * Le corps de `setProfileLibraries` : `{ allowed }` EXACTEMENT — null, ou une
 * liste non vide d'identifiants distincts. null sinon. L'appartenance au
 * plafond se juge dans le service, qui le connaît.
 */
export function parseLibrariesBody(body: unknown): { allowed: WantedLibraries } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== "allowed") return null;
  const allowed = (body as { allowed: unknown }).allowed;
  if (allowed === null) return { allowed: null };
  if (!Array.isArray(allowed) || allowed.length === 0 || allowed.length > FAMILY_LIBRARIES_MAX) return null;
  if (!allowed.every((id): id is string => typeof id === "string" && /^[0-9a-fA-F-]{32,36}$/.test(id))) return null;
  if (new Set(allowed.map(normalizeJellyfinId)).size !== allowed.length) return null;
  return { allowed: [...allowed] };
}

/** La liste voulue, relue en base : absente = toutes ; illisible = AUCUNE (le plus fermé, jamais « toutes »). */
export function storedWantedLibraries(raw: string | null | undefined): WantedLibraries {
  if (raw === null || raw === undefined || raw === "") return null;
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every((id) => typeof id === "string") ? (value as string[]) : [];
  } catch {
    return [];
  }
}
