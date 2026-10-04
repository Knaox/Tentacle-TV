import { randomUUID } from "crypto";
import { getPrisma } from "../db";
import { getJellyfinUsers, type CachedJellyfinUser } from "../watchTogether/usersCache";
import { defaultProfileColor, isProfileColor, type FamilyCounts } from "../../family/familyRules";
import type { FamilyProfileColor, FamilyProfileKind, FamilyRole } from "../../family/familyContract";
import { FamilyFailure } from "./familyErrors";

/**
 * La Famille en base (v2) : UNE famille par compte. Chaque personne de la
 * famille a SA ligne dans `family_members` — le propriétaire (`owner`), les
 * membres, les invités — et l'unicité de `userId` en base interdit d'en avoir
 * deux : un compte ne peut être ni propriétaire de deux familles, ni membre
 * de deux, ni l'un et l'autre. Les identifiants de comptes sont ceux que
 * Jellyfin rend (le porteur d'un jeton) ; les comparaisons tolèrent tirets et
 * casse.
 */

export interface FamilyRow {
  id: string;
  ownerUserId: string;
  ownerName: string;
  ownerColor: string | null;
  createdAt: Date;
}

export interface MemberRow {
  id: string;
  familyId: string;
  userId: string;
  kind: string;
  displayName: string;
  color: string | null;
  jellyfinName: string | null;
  /** Invité : son créateur (null avant la v2 : le propriétaire). */
  createdBy: string | null;
  /** Membre : le droit de créer des invités. */
  canCreateGuests: boolean;
  /** Invité : « peut demander » — ses extensions, au nom du propriétaire. */
  canRequestTitles: boolean;
  createdAt: Date;
}

/** La famille d'une personne, et à quel titre elle en est. */
export interface FamilyMembership {
  family: FamilyRow;
  role: FamilyRole;
  /** Sa ligne dans la famille. */
  self: MemberRow;
}

export function fold(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

export function profileColor(stored: string | null, userId: string): FamilyProfileColor {
  return isProfileColor(stored) ? stored : defaultProfileColor(userId);
}

export function memberKind(row: MemberRow): FamilyProfileKind {
  return row.kind === "guest" ? "guest" : row.kind === "owner" ? "owner" : "member";
}

/** Une violation d'unicité Prisma (P2002). */
export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "P2002";
}

export async function findOwnedFamily(ownerUserId: string): Promise<FamilyRow | null> {
  return getPrisma().family.findUnique({ where: { ownerUserId } });
}

export async function findFamily(id: string): Promise<FamilyRow | null> {
  return getPrisma().family.findUnique({ where: { id } });
}

/** La famille de cette personne — propriétaire ou membre ; null pour un
 *  invité (il n'agit pas) et pour un compte sans famille. */
export async function familyOf(userId: string): Promise<FamilyMembership | null> {
  const self = await getPrisma().familyMember.findUnique({ where: { userId } });
  if (!self || (self.kind !== "owner" && self.kind !== "member")) return null;
  const family = await findFamily(self.familyId);
  return family ? { family, role: self.kind === "owner" ? "owner" : "member", self } : null;
}

/**
 * La famille que possède ce compte, créée au besoin. La ligne du
 * propriétaire passe EN PREMIER : si le compte est déjà dans une famille,
 * l'unicité la refuse avant que rien d'autre ne soit écrit
 * (`family.already_in_family`).
 */
export async function ensureOwnedFamily(owner: { userId: string; name: string }): Promise<FamilyRow> {
  const prisma = getPrisma();
  const existing = await findOwnedFamily(owner.userId);
  if (existing) return existing;
  const familyId = randomUUID().replace(/-/g, "");
  try {
    await prisma.familyMember.create({
      data: { familyId, userId: owner.userId, kind: "owner", displayName: owner.name.slice(0, 100) },
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new FamilyFailure("family.already_in_family", "Déjà dans une famille");
    throw error;
  }
  try {
    return await prisma.family.create({ data: { id: familyId, ownerUserId: owner.userId, ownerName: owner.name } });
  } catch (error) {
    await prisma.familyMember.deleteMany({ where: { familyId, userId: owner.userId, kind: "owner" } });
    const again = await findOwnedFamily(owner.userId);
    if (again) return again;
    throw error;
  }
}

/** Toutes les lignes d'une famille, propriétaire compris, par ordre d'arrivée. */
export async function familyProfiles(familyId: string): Promise<MemberRow[]> {
  return getPrisma().familyMember.findMany({ where: { familyId }, orderBy: { createdAt: "asc" } });
}

export async function findProfile(familyId: string, userId: string): Promise<MemberRow | null> {
  const rows = await familyProfiles(familyId);
  return rows.find((row) => fold(row.userId) === fold(userId)) ?? null;
}

/** Les PERSONNES d'une famille (propriétaire et membres) : celles qui la
 *  voient, la relisent et dont les TV la montrent. */
export function personsOf(family: FamilyRow, rows: MemberRow[]): string[] {
  const persons = rows.filter((row) => row.kind === "member").map((row) => row.userId);
  return [family.ownerUserId, ...persons];
}

/** Profils présents (hors propriétaire) et invitations en attente (encore valables). */
export async function familyCounts(familyId: string, now: number): Promise<FamilyCounts> {
  const prisma = getPrisma();
  const rows = await familyProfiles(familyId);
  const pendingInvitations = await prisma.familyInvitation.count({
    where: { familyId, status: "pending", expiresAt: { gt: new Date(now) } },
  });
  return {
    members: rows.filter((row) => row.kind === "member").length,
    guests: rows.filter((row) => row.kind === "guest").length,
    pendingInvitations,
  };
}

/** @deprecated v1 — la famille dont ce compte est MEMBRE (une au plus en v2) : `familyOf`. */
export async function membershipsOf(userId: string): Promise<Array<{ row: MemberRow; family: FamilyRow }>> {
  const mine = await familyOf(userId);
  return mine?.role === "member" ? [{ row: mine.self, family: mine.family }] : [];
}

/** Ce compte est-il un invité (d'une famille quelconque) ? */
export async function guestRowOf(userId: string): Promise<MemberRow | null> {
  const row = await getPrisma().familyMember.findUnique({ where: { userId } });
  return row?.kind === "guest" ? row : null;
}

/**
 * Le refus d'un geste sur une cible qui n'est pas à la portée du porteur
 * (SEC-F-07) : 403 si la cible est dans SA famille — il sait qu'elle existe,
 * il n'en a pas le droit —, 404 sinon (rien ne confirme l'existence de la
 * famille d'autrui). Sans cible (dissoudre) : 403 pour un membre.
 */
export async function ownerRefusal(callerUserId: string, targetUserId: string | null): Promise<FamilyFailure> {
  const mine = await familyOf(callerUserId);
  if (mine?.role === "member") {
    if (targetUserId === null) return new FamilyFailure("family.not_owner", "Réservé au propriétaire de la famille");
    if ((await findProfile(mine.family.id, targetUserId)) !== null) {
      return new FamilyFailure("family.not_owner", "Réservé au propriétaire de la famille");
    }
  }
  return new FamilyFailure("family.not_found", "Introuvable");
}

/** Les comptes Jellyfin, par identifiant plié ; null si Jellyfin ne répond pas. */
export async function jellyfinUserMap(): Promise<Map<string, CachedJellyfinUser> | null> {
  const users = await getJellyfinUsers();
  return users ? new Map(users.map((user) => [fold(user.id), user])) : null;
}
