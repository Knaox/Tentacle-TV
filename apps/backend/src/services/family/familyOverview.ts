import { getPrisma } from "../db";
import type { CachedJellyfinUser } from "../watchTogether/usersCache";
import {
  FAMILY_CONTRACT_VERSION,
  FAMILY_MAX_GUESTS,
  FAMILY_MAX_PROFILES,
  type FamilyDto,
  type FamilyOverviewDto,
  type FamilyProfileDto,
  type FamilyRole,
  type IncomingInvitationDto,
  type OutgoingInvitationDto,
} from "../../family/familyContract";
import { familyRightsOf } from "../../family/familyRights";
import { getFamilySwitches, isReviewAccount } from "./familyConfig";
import { profilesWithPin } from "./familyPins";
import {
  familyOf,
  familyProfiles,
  fold,
  guestRowOf,
  jellyfinUserMap,
  memberKind,
  profileColor,
  type FamilyRow,
  type MemberRow,
} from "./familyStore";

/**
 * `GET /api/family` — l'état de la Famille pour le porteur du jeton : SA
 * famille (`family`, la même pour le propriétaire et chaque membre :
 * propriétaire en tête, puis membres, puis invités ; les invitations en
 * attente au seul propriétaire), et — en session personnelle, pour un compte
 * qui n'est dans aucune famille — les invitations qu'il a reçues. `owned` et
 * `memberships` gardent la forme v1 tant que des clients la lisent. Les noms
 * et avatars viennent de Jellyfin quand il répond, sinon du dernier nom connu.
 */

export interface OverviewCaller {
  userId: string;
  username: string;
  personal: boolean;
}

type UserMap = Map<string, CachedJellyfinUser> | null;

function nameOf(users: UserMap, userId: string, fallback: string): string {
  return users?.get(fold(userId))?.name ?? fallback;
}

function imageOf(users: UserMap, userId: string): string | null {
  return users?.get(fold(userId))?.imageTag ?? null;
}

export function invitationDates(row: { createdAt: Date; expiresAt: Date }) {
  return { createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString() };
}

/** Le créateur d'un invité : le sien, ou — ligne d'avant la v2 — le propriétaire. */
function creatorOf(family: FamilyRow, row: MemberRow): { createdBy: string; fallbackName: string | null } {
  const createdBy = row.createdBy ?? family.ownerUserId;
  return { createdBy, fallbackName: fold(createdBy) === fold(family.ownerUserId) ? family.ownerName : null };
}

/** Les profils d'une famille : le propriétaire (sa ligne `owner`), puis les
 *  membres, puis les invités, chacun dans son ordre d'arrivée. */
export function profileDtos(family: FamilyRow, rows: MemberRow[], users: UserMap, pins: Set<string>): FamilyProfileDto[] {
  const ownerRow = rows.find((row) => row.kind === "owner") ?? null;
  const owner: FamilyProfileDto = {
    userId: family.ownerUserId,
    kind: "owner",
    name: nameOf(users, family.ownerUserId, family.ownerName),
    color: profileColor(ownerRow?.color ?? family.ownerColor, family.ownerUserId),
    hasPin: pins.has(family.ownerUserId),
    imageTag: imageOf(users, family.ownerUserId),
    since: null,
    createdBy: null,
    createdByName: null,
    rights: null,
    guestRights: null,
  };
  const others = rows
    .filter((row) => row.kind !== "owner")
    .map((row): FamilyProfileDto => {
      const guest = row.kind === "guest";
      const creator = guest ? creatorOf(family, row) : null;
      return {
        userId: row.userId,
        kind: memberKind(row),
        name: guest ? row.displayName : nameOf(users, row.userId, row.displayName),
        color: profileColor(row.color, row.userId),
        hasPin: pins.has(row.userId),
        imageTag: guest ? null : imageOf(users, row.userId),
        since: row.createdAt.toISOString(),
        createdBy: creator?.createdBy ?? null,
        createdByName: creator ? users?.get(fold(creator.createdBy))?.name ?? creator.fallbackName : null,
        rights: guest ? null : { createGuests: row.canCreateGuests === true },
        guestRights: guest ? { requestTitles: row.canRequestTitles === true } : null,
      };
    })
    .sort((a, b) => Number(a.kind === "guest") - Number(b.kind === "guest"));
  return [owner, ...others];
}

async function pendingOf(family: FamilyRow, users: UserMap, now: number): Promise<OutgoingInvitationDto[]> {
  const pending = await getPrisma().familyInvitation.findMany({
    where: { familyId: family.id, status: "pending", expiresAt: { gt: new Date(now) } },
    orderBy: { createdAt: "asc" },
  });
  return pending.map((row) => ({
    id: row.id,
    inviteeUserId: row.inviteeUserId,
    inviteeName: nameOf(users, row.inviteeUserId, row.inviteeName),
    ...invitationDates(row),
  }));
}

/** LA famille du porteur, vue par lui : son rôle, ses droits. */
async function familyView(family: FamilyRow, role: FamilyRole, self: MemberRow | null, users: UserMap, now: number): Promise<FamilyDto> {
  const rows = await familyProfiles(family.id);
  const pins = await profilesWithPin(rows.map((row) => row.userId).concat(family.ownerUserId));
  return {
    id: family.id,
    role,
    owner: { userId: family.ownerUserId, name: nameOf(users, family.ownerUserId, family.ownerName) },
    profiles: profileDtos(family, rows, users, pins),
    pendingInvitations: role === "owner" ? await pendingOf(family, users, now) : [],
    rights: familyRightsOf(role, self ? { createGuests: self.canCreateGuests === true } : null, getFamilySwitches()),
    createdAt: family.createdAt.toISOString(),
    since: self ? self.createdAt.toISOString() : null,
  };
}

async function incomingOf(caller: OverviewCaller, users: UserMap, now: number): Promise<IncomingInvitationDto[]> {
  const prisma = getPrisma();
  const rows = await prisma.familyInvitation.findMany({
    where: { inviteeUserId: caller.userId, status: "pending", expiresAt: { gt: new Date(now) } },
    orderBy: { createdAt: "asc" },
  });
  const owners = rows.length
    ? await prisma.family.findMany({ where: { id: { in: rows.map((row) => row.familyId) } }, select: { id: true, ownerName: true } })
    : [];
  const ownerNames = new Map(owners.map((row) => [row.id, row.ownerName]));
  return rows.map((row) => ({
    id: row.id,
    familyId: row.familyId,
    ownerUserId: row.ownerUserId,
    ownerName: nameOf(users, row.ownerUserId, ownerNames.get(row.familyId) ?? ""),
    ...invitationDates(row),
    snoozedUntil: row.snoozedUntil && row.snoozedUntil.getTime() > now ? row.snoozedUntil.toISOString() : null,
  }));
}

export async function buildOverview(caller: OverviewCaller, now: number): Promise<FamilyOverviewDto> {
  const users = await jellyfinUserMap();
  const [review, guest] = await Promise.all([isReviewAccount(caller.userId), guestRowOf(caller.userId)]);

  const mine = await familyOf(caller.userId);
  const family = mine ? await familyView(mine.family, mine.role, mine.role === "member" ? mine.self : null, users, now) : null;
  const owned: FamilyOverviewDto["owned"] =
    mine?.role === "owner" && family
      ? { id: family.id, profiles: family.profiles, pendingInvitations: family.pendingInvitations, createdAt: family.createdAt }
      : null;
  const memberships =
    mine?.role === "member" && family
      ? [{ familyId: family.id, ownerUserId: family.owner.userId, ownerName: family.owner.name, since: family.since ?? "" }]
      : [];

  return {
    v: FAMILY_CONTRACT_VERSION,
    switches: getFamilySwitches(),
    account: {
      canOwn: !guest && !review && mine?.role !== "member",
      canJoin: !guest && !review && mine === null,
      reviewAccount: review,
      hasPin: (await profilesWithPin([caller.userId])).has(caller.userId),
      personalSession: caller.personal,
    },
    family,
    owned,
    memberships,
    incoming: caller.personal && mine === null ? await incomingOf(caller, users, now) : [],
    limits: { maxProfiles: FAMILY_MAX_PROFILES, maxGuests: FAMILY_MAX_GUESTS },
  };
}
