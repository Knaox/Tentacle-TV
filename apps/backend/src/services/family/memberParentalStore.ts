import { getPrisma } from "../db";
import type { GuestParentalCeiling, GuestParentalControls } from "../../family/familyParental";
import { UNRATED_ITEM_TYPES } from "../../userRights/userRightsContract";
import { parseGuestParental } from "./guestParentalPolicy";
import { storedWantedLibraries, type LibraryAccess, type WantedLibraries } from "./familyLibraryRules";

/**
 * Le contrôle parental d'un membre mineur EN BASE (`family_member_parental`) : le
 * voulu, la base et la dernière écriture, en JSON — l'âge et les autres champs
 * parentaux d'un côté, les BIBLIOTHÈQUES de l'autre (1.30.0). Une ligne illisible
 * ne relâche jamais rien : un voulu illisible vaut le plus fermé, une base
 * illisible empêche de « rendre » (la ligne reste, journalisée) plutôt que de deviner.
 */

export interface MemberParentalState {
  userId: string;
  familyId: string;
  /** null : retiré — la base reste à rendre. */
  controls: GuestParentalControls | null;
  base: GuestParentalCeiling;
  written: GuestParentalCeiling | null;
  restorePending: boolean;
  /** Les bibliothèques voulues ; null : toutes celles de la base. */
  libraries: WantedLibraries;
  /** Les bibliothèques de la base ; null : pas encore relevées (la politique lue les donne). */
  libraryBase: LibraryAccess | null;
  libraryWritten: LibraryAccess | null;
}

/** La ligne retient-elle encore quelque chose ? Sinon, la base est à rendre. */
export function memberRestricted(state: Pick<MemberParentalState, "controls" | "libraries">): boolean {
  return state.controls !== null || state.libraries !== null;
}

/** Un voulu illisible : le plus fermé, jamais « aucun ». */
const CLOSED_CONTROLS: GuestParentalControls = {
  maxParentalRating: 0,
  maxParentalSubRating: null,
  blockUnratedItems: [...UNRATED_ITEM_TYPES],
  blockedTags: [],
  accessSchedules: [],
};

function parseCeiling(raw: string | null): GuestParentalCeiling | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const { allowedTags, ...controls } = value;
    const parsed = parseGuestParental(controls);
    if (!parsed || !Array.isArray(allowedTags) || !allowedTags.every((tag) => typeof tag === "string")) return null;
    // La sous-note de la base se garde telle que Jellyfin la portait, même sans note : rendue à l'identique.
    return { ...parsed, maxParentalSubRating: typeof value.maxParentalSubRating === "number" ? value.maxParentalSubRating : null, allowedTags };
  } catch {
    return null;
  }
}

function parseControls(raw: string | null): GuestParentalControls | null {
  if (raw === null) return null;
  try {
    return parseGuestParental(JSON.parse(raw)) ?? { ...CLOSED_CONTROLS };
  } catch {
    return { ...CLOSED_CONTROLS };
  }
}

/** Un accès `{ all, ids }` ; absent : null ; illisible : `undefined` (la ligne ne se relâche pas). */
function parseAccess(raw: string | null): LibraryAccess | null | undefined {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const ids = value.ids;
    if (typeof value.all !== "boolean" || !Array.isArray(ids) || !ids.every((id) => typeof id === "string")) return undefined;
    return { all: value.all, ids: ids as string[] };
  } catch {
    return undefined;
  }
}

type Row = {
  userId: string;
  familyId: string;
  controls: string | null;
  base: string;
  written: string | null;
  restorePending: boolean;
  libraries: string | null;
  libraryBase: string | null;
  libraryWritten: string | null;
};

function stateOf(row: Row): MemberParentalState | null {
  const base = parseCeiling(row.base);
  const libraryBase = parseAccess(row.libraryBase);
  if (!base || libraryBase === undefined) {
    console.log("[family] contrôle parental d'un membre : base illisible en base, rien n'est relâché");
    return null;
  }
  return {
    userId: row.userId,
    familyId: row.familyId,
    controls: parseControls(row.controls),
    base,
    written: parseCeiling(row.written),
    restorePending: row.restorePending,
    libraries: storedWantedLibraries(row.libraries),
    libraryBase,
    libraryWritten: parseAccess(row.libraryWritten) ?? null,
  };
}

export async function readMemberParental(userId: string): Promise<MemberParentalState | null> {
  const row = await getPrisma().familyMemberParental.findUnique({ where: { userId } });
  return row ? stateOf(row) : null;
}

/** Toutes les lignes : actives (à tenir) et à rendre. */
export async function allMemberParental(): Promise<MemberParentalState[]> {
  const rows = await getPrisma().familyMemberParental.findMany();
  return rows.flatMap((row) => stateOf(row) ?? []);
}

export async function familyMemberParental(familyId: string): Promise<MemberParentalState[]> {
  const rows = await getPrisma().familyMemberParental.findMany({ where: { familyId } });
  return rows.flatMap((row) => stateOf(row) ?? []);
}

/** Existe-t-il au moins une ligne ? (le guet ne lit Jellyfin que dans ce cas) */
export async function hasMemberParental(): Promise<boolean> {
  return (await getPrisma().familyMemberParental.count()) > 0;
}

export async function saveMemberParental(state: MemberParentalState): Promise<void> {
  const data = {
    familyId: state.familyId,
    controls: state.controls ? JSON.stringify(state.controls) : null,
    base: JSON.stringify(state.base),
    written: state.written ? JSON.stringify(state.written) : null,
    restorePending: state.restorePending,
    libraries: state.libraries ? JSON.stringify(state.libraries) : null,
    libraryBase: state.libraryBase ? JSON.stringify(state.libraryBase) : null,
    libraryWritten: state.libraryWritten ? JSON.stringify(state.libraryWritten) : null,
  };
  await getPrisma().familyMemberParental.upsert({ where: { userId: state.userId }, create: { userId: state.userId, ...data }, update: data });
}

export async function deleteMemberParental(userId: string): Promise<void> {
  await getPrisma().familyMemberParental.deleteMany({ where: { userId } });
}
