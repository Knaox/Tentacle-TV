import { getPrisma } from "../db";
import { getJellyfinUsers, type CachedJellyfinUser } from "../watchTogether/usersCache";
import { defaultProfileColor, isProfileColor, type FamilyCounts } from "../../family/familyRules";
import type { FamilyProfileColor, FamilyProfileKind } from "../../family/familyContract";
import { FamilyFailure } from "./familyErrors";

/**
 * La Famille en base : familles, profils (membres et invités), capacités,
 * adhésions. Les identifiants de comptes sont ceux que Jellyfin rend (le
 * porteur d'un jeton) ; les comparaisons tolèrent tirets et casse.
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
  createdAt: Date;
}

export function fold(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

export function profileColor(stored: string | null, userId: string): FamilyProfileColor {
  return isProfileColor(stored) ? stored : defaultProfileColor(userId);
}

export function memberKind(row: MemberRow): Exclude<FamilyProfileKind, "owner"> {
  return row.kind === "guest" ? "guest" : "member";
}

export async function findOwnedFamily(ownerUserId: string): Promise<FamilyRow | null> {
  return getPrisma().family.findUnique({ where: { ownerUserId } });
}

export async function findFamily(id: string): Promise<FamilyRow | null> {
  return getPrisma().family.findUnique({ where: { id } });
}

/** La famille du propriétaire, créée au besoin. Une seule par propriétaire :
 *  l'unicité est une contrainte de la base, une course perdue relit la gagnante. */
export async function ensureOwnedFamily(owner: { userId: string; name: string }): Promise<FamilyRow> {
  const prisma = getPrisma();
  const existing = await findOwnedFamily(owner.userId);
  if (existing) return existing;
  try {
    return await prisma.family.create({ data: { ownerUserId: owner.userId, ownerName: owner.name } });
  } catch (error) {
    const again = await findOwnedFamily(owner.userId);
    if (again) return again;
    throw error;
  }
}

export async function familyProfiles(familyId: string): Promise<MemberRow[]> {
  return getPrisma().familyMember.findMany({ where: { familyId }, orderBy: { createdAt: "asc" } });
}

export async function findProfile(familyId: string, userId: string): Promise<MemberRow | null> {
  const rows = await familyProfiles(familyId);
  return rows.find((row) => fold(row.userId) === fold(userId)) ?? null;
}

/** Profils présents et invitations en attente (encore valables). */
export async function familyCounts(familyId: string, now: number): Promise<FamilyCounts> {
  const prisma = getPrisma();
  const rows = await familyProfiles(familyId);
  const pendingInvitations = await prisma.familyInvitation.count({
    where: { familyId, status: "pending", expiresAt: { gt: new Date(now) } },
  });
  return {
    members: rows.filter((row) => row.kind !== "guest").length,
    guests: rows.filter((row) => row.kind === "guest").length,
    pendingInvitations,
  };
}

/** Les familles dont ce compte est MEMBRE. */
export async function membershipsOf(userId: string): Promise<Array<{ row: MemberRow; family: FamilyRow }>> {
  const prisma = getPrisma();
  const rows = await prisma.familyMember.findMany({ where: { userId, kind: "member" } });
  if (rows.length === 0) return [];
  const families = await prisma.family.findMany({ where: { id: { in: rows.map((row) => row.familyId) } } });
  const byId = new Map(families.map((family) => [family.id, family]));
  return rows.flatMap((row) => {
    const family = byId.get(row.familyId);
    return family ? [{ row, family }] : [];
  });
}

/** Ce compte est-il un invité (d'une famille quelconque) ? */
export async function guestRowOf(userId: string): Promise<MemberRow | null> {
  const rows = await getPrisma().familyMember.findMany({ where: { userId, kind: "guest" } });
  return rows[0] ?? null;
}

/**
 * Le refus d'un geste de propriétaire sur une cible qui n'est pas dans SA
 * famille (SEC-F-07) : 403 si le porteur est MEMBRE de la famille de la cible
 * — il sait qu'elle existe, il n'en est pas le propriétaire —, 404 sinon (rien
 * ne confirme l'existence de la famille d'autrui).
 */
export async function ownerRefusal(callerUserId: string, targetUserId: string | null): Promise<FamilyFailure> {
  const memberships = await membershipsOf(callerUserId);
  if (memberships.length > 0) {
    if (targetUserId === null) return new FamilyFailure("family.not_owner", "Réservé au propriétaire de la famille");
    for (const { family } of memberships) {
      const inside = fold(family.ownerUserId) === fold(targetUserId) || (await findProfile(family.id, targetUserId)) !== null;
      if (inside) return new FamilyFailure("family.not_owner", "Réservé au propriétaire de la famille");
    }
  }
  return new FamilyFailure("family.not_found", "Introuvable");
}

/** Les comptes Jellyfin, par identifiant plié ; null si Jellyfin ne répond pas. */
export async function jellyfinUserMap(): Promise<Map<string, CachedJellyfinUser> | null> {
  const users = await getJellyfinUsers();
  return users ? new Map(users.map((user) => [fold(user.id), user])) : null;
}
