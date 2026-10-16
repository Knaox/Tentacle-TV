import { getPrisma, hasPrisma } from "../db";
import { invalidateContentPolicy } from "../contentPolicy";
import { jellyfinAdminFetch } from "../jellyfinAdminFetch";
import { FamilyFailure } from "./familyErrors";
import { fold } from "./familyStore";
import { fetchUser, writePolicy, type UserDto } from "./guestAccounts";
import { resyncGuestsOfCreator } from "./guestPolicySync";
import {
  memberParentalTarget,
  parentalOfPolicy,
  previousWrite,
  rebaseMemberParental,
  sameParental,
  withParentalFields,
} from "./memberParentalRules";
import { allMemberParental, deleteMemberParental, memberRestricted, readMemberParental, saveMemberParental, type MemberParentalState } from "./memberParentalStore";
import { effectiveLibraryAccess, libraryAccessOfPolicy, sameLibraryAccess, settledLibraryBase, withLibraryAccess } from "./familyLibraryRules";

/**
 * Le contrôle parental d'un MEMBRE mineur tenu dans Jellyfin (docs/DROITS-UTILISATEURS.md
 * § 9.4, et § 9.8 pour ses bibliothèques). Un seul geste, `settle` : relire la politique,
 * faire de chaque champ changé ailleurs la nouvelle base, écrire la cible (base ∩ voulu,
 * ou la base seule quand le contrôle est retiré) — âge et bibliothèques en UNE écriture —,
 * relire, garder. Quatre moments :
 * - la pose ou le retrait par la famille (`setMemberParental`, strict : un refus de
 *   Jellyfin se dit) ;
 * - toute écriture de politique faite par Tentacle (`notePolicyWritten`, AVANT que les
 *   invités du compte ne suivent) ;
 * - l'ouverture d'un profil de ce membre sur une TV ou un bureau ;
 * - le guet des deux minutes (`resyncMemberParental`), avec celui des invités, qui
 *   rejoue aussi les bases à rendre (membre parti, famille dissoute, Jellyfin muet).
 */

export interface SettledMemberParental {
  /** L'état gardé ; null : base rendue, ligne effacée. */
  state: MemberParentalState | null;
  /** Une écriture a eu lieu chez Jellyfin. */
  wrote: boolean;
}

/** Garde l'état, puis amène la politique du membre à sa cible. */
export async function settleMemberParental(state: MemberParentalState, user: UserDto, strict: boolean): Promise<SettledMemberParental> {
  const userId = state.userId;
  const policy = user.Policy ?? {};
  const current = parentalOfPolicy(policy);
  const previous = previousWrite(state.base, state.controls, state.written);
  const base = sameParental(current, previous) ? state.base : rebaseMemberParental(state.base, previous, current);
  const target = memberParentalTarget(base, state.controls);
  // Les bibliothèques, la même règle : jamais relevées, la politique lue EST la base (la famille n'y a rien écrit).
  const currentLibraries = libraryAccessOfPolicy(policy);
  const libraryBase = settledLibraryBase(state.libraryBase, state.libraryWritten, state.libraries, currentLibraries);
  const libraryTarget = effectiveLibraryAccess(libraryBase, state.libraries);
  let written = current;
  let libraryWritten = currentLibraries;
  const wrote = !sameParental(current, target) || !sameLibraryAccess(currentLibraries, libraryTarget);
  if (wrote) {
    await writePolicy(userId, withLibraryAccess(withParentalFields(userId, policy, target), libraryTarget));
    invalidateContentPolicy(userId);
    const rereadPolicy = (await fetchUser(userId)).Policy ?? {};
    const reread = parentalOfPolicy(rereadPolicy);
    const rereadLibraries = libraryAccessOfPolicy(rereadPolicy);
    if (!sameParental(reread, target) || !sameLibraryAccess(rereadLibraries, libraryTarget)) {
      // Jellyfin n'a pas retenu : la dernière écriture reste l'ancienne, le guet rejouera.
      await saveMemberParental({ ...state, base, libraryBase, restorePending: !memberRestricted(state) });
      if (strict) throw new FamilyFailure("family.jellyfin_refused", "Contrôle parental du membre non retenu par Jellyfin");
      return { state: { ...state, base, libraryBase }, wrote };
    }
    written = reread;
    libraryWritten = rereadLibraries;
    // Ses invités suivent sa politique effective (leur plafond, c'est lui).
    await resyncGuestsOfCreator(userId).catch(() => undefined);
  }
  if (!memberRestricted(state)) {
    await deleteMemberParental(userId);
    console.log("[family] Contrôle parental d'un membre retiré : sa politique de base est rendue");
    return { state: null, wrote };
  }
  const next: MemberParentalState = { ...state, base, written, libraryBase, libraryWritten, restorePending: false };
  await saveMemberParental(next);
  return { state: next, wrote };
}

/** Le membre de cette ligne est-il encore un membre restreignable de SA famille ? Sinon : base à rendre. */
async function stillRestrictable(state: MemberParentalState): Promise<boolean> {
  const row = await getPrisma().familyMember.findUnique({ where: { userId: state.userId } });
  return !!row && row.kind === "member" && row.familyId === state.familyId && row.isParent !== true;
}

async function settleQuietly(state: MemberParentalState, user: UserDto): Promise<boolean> {
  try {
    const kept = memberRestricted(state) && (await stillRestrictable(state)) ? state : { ...state, controls: null, libraries: null };
    return (await settleMemberParental({ ...kept, restorePending: !memberRestricted(kept) }, user, false)).wrote;
  } catch {
    console.log("[family] contrôle parental d'un membre non resynchronisé (Jellyfin ou base muets)");
    return false;
  }
}

/** Après une écriture de politique faite par Tentacle sur ce compte, ou à l'ouverture de son profil. Silencieux. */
export async function syncMemberParental(userId: string): Promise<void> {
  if (!hasPrisma()) return;
  const state = await readMemberParental(fold(userId)).catch(() => null);
  if (!state) return;
  try {
    await settleQuietly(state, await fetchUser(state.userId));
  } catch {
    console.log("[family] contrôle parental d'un membre non resynchronisé (Jellyfin muet)");
  }
}

/**
 * La base rendue : le contrôle passe à « retiré » (gardé d'abord, durable), puis la base
 * est réécrite. Jellyfin muet : la ligne reste « à rendre », le guet la rejouera. Rend vrai
 * si la base est rendue (ou s'il n'y avait rien).
 */
export async function restoreMemberParental(userId: string): Promise<boolean> {
  const state = await readMemberParental(fold(userId));
  if (!state) return true;
  const pending: MemberParentalState = { ...state, controls: null, libraries: null, restorePending: true };
  await saveMemberParental(pending);
  try {
    return (await settleMemberParental(pending, await fetchUser(state.userId), false)).state === null;
  } catch {
    console.log("[family] base d'un membre pas encore rendue (Jellyfin muet) : le guet la rejouera");
    return false;
  }
}

const WATCH_MS = 2 * 60_000;
let timer: ReturnType<typeof setInterval> | null = null;

/** Le guet des membres mineurs, à côté de celui des invités ; une première passe peu après le démarrage. */
export function startMemberParentalWatch(): void {
  if (timer) return;
  timer = setInterval(() => void resyncMemberParental().catch(() => undefined), WATCH_MS);
  setTimeout(() => void resyncMemberParental().catch(() => undefined), 15_000).unref?.();
}

export function stopMemberParentalWatch(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Le guet : toutes les lignes d'après UNE lecture des comptes ; rien à lire s'il n'y en a aucune. */
export async function resyncMemberParental(): Promise<number> {
  if (!hasPrisma()) return 0;
  const states = await allMemberParental();
  if (states.length === 0) return 0;
  const users = await jellyfinAdminFetch<UserDto[]>("/Users");
  if (!users.ok || !Array.isArray(users.data)) return 0;
  const byId = new Map(users.data.filter((user) => user.Id).map((user) => [fold(user.Id as string), user]));
  let changed = 0;
  for (const state of states) {
    const user = byId.get(fold(state.userId));
    // Compte disparu : le balayage de la Famille efface sa ligne (`forgetFamilyAccount`).
    if (user && (await settleQuietly(state, user))) changed++;
  }
  if (changed > 0) console.log(`[family] ${changed} membre(s) mineur(s) recalé(s)`);
  return changed;
}
