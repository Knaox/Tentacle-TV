import { getPrisma } from "../db";
import type { CachedJellyfinUser } from "../watchTogether/usersCache";
import {
  FAMILY_CONTRACT_VERSION,
  FAMILY_MAX_GUESTS,
  FAMILY_MAX_PROFILES,
  type FamilyOverviewDto,
  type FamilyProfileDto,
  type IncomingInvitationDto,
  type OutgoingInvitationDto,
} from "../../family/familyContract";
import { getFamilySwitches, isReviewAccount } from "./familyConfig";
import { profilesWithPin } from "./familyPins";
import {
  familyProfiles,
  findOwnedFamily,
  fold,
  guestRowOf,
  jellyfinUserMap,
  memberKind,
  membershipsOf,
  profileColor,
  type FamilyRow,
  type MemberRow,
} from "./familyStore";

/**
 * `GET /api/family` — l'état de la Famille pour le porteur du jeton : la
 * famille qu'il possède (propriétaire en tête, puis membres, puis invités ;
 * ses invitations en attente), celles dont il est membre, et — en session
 * personnelle seulement — les invitations qu'il a reçues. Les noms et avatars
 * viennent de Jellyfin quand il répond, sinon du dernier nom connu.
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

function profileDtos(family: FamilyRow, rows: MemberRow[], users: UserMap, pins: Set<string>): FamilyProfileDto[] {
  const owner: FamilyProfileDto = {
    userId: family.ownerUserId,
    kind: "owner",
    name: nameOf(users, family.ownerUserId, family.ownerName),
    color: profileColor(family.ownerColor, family.ownerUserId),
    hasPin: pins.has(family.ownerUserId),
    imageTag: imageOf(users, family.ownerUserId),
    since: null,
  };
  const others = rows
    .map((row): FamilyProfileDto => ({
      userId: row.userId,
      kind: memberKind(row),
      name: row.kind === "guest" ? row.displayName : nameOf(users, row.userId, row.displayName),
      color: profileColor(row.color, row.userId),
      hasPin: pins.has(row.userId),
      imageTag: row.kind === "guest" ? null : imageOf(users, row.userId),
      since: row.createdAt.toISOString(),
    }))
    .sort((a, b) => Number(a.kind === "guest") - Number(b.kind === "guest"));
  return [owner, ...others];
}

export async function buildOverview(caller: OverviewCaller, now: number): Promise<FamilyOverviewDto> {
  const prisma = getPrisma();
  const users = await jellyfinUserMap();
  const [review, guest] = await Promise.all([isReviewAccount(caller.userId), guestRowOf(caller.userId)]);

  let owned: FamilyOverviewDto["owned"] = null;
  const family = await findOwnedFamily(caller.userId);
  if (family) {
    const rows = await familyProfiles(family.id);
    const pins = await profilesWithPin([family.ownerUserId, ...rows.map((row) => row.userId)]);
    const pending = await prisma.familyInvitation.findMany({
      where: { familyId: family.id, status: "pending", expiresAt: { gt: new Date(now) } },
      orderBy: { createdAt: "asc" },
    });
    owned = {
      id: family.id,
      profiles: profileDtos(family, rows, users, pins),
      pendingInvitations: pending.map((row): OutgoingInvitationDto => ({
        id: row.id,
        inviteeUserId: row.inviteeUserId,
        inviteeName: nameOf(users, row.inviteeUserId, row.inviteeName),
        ...invitationDates(row),
      })),
      createdAt: family.createdAt.toISOString(),
    };
  }

  const memberships = (await membershipsOf(caller.userId)).map(({ row, family: joined }) => ({
    familyId: joined.id,
    ownerUserId: joined.ownerUserId,
    ownerName: nameOf(users, joined.ownerUserId, joined.ownerName),
    since: row.createdAt.toISOString(),
  }));

  let incoming: IncomingInvitationDto[] = [];
  if (caller.personal) {
    const rows = await prisma.familyInvitation.findMany({
      where: { inviteeUserId: caller.userId, status: "pending", expiresAt: { gt: new Date(now) } },
      orderBy: { createdAt: "asc" },
    });
    const owners = rows.length
      ? await prisma.family.findMany({ where: { id: { in: rows.map((row) => row.familyId) } }, select: { id: true, ownerName: true } })
      : [];
    const ownerNames = new Map(owners.map((row) => [row.id, row.ownerName]));
    incoming = rows.map((row) => ({
      id: row.id,
      familyId: row.familyId,
      ownerUserId: row.ownerUserId,
      ownerName: nameOf(users, row.ownerUserId, ownerNames.get(row.familyId) ?? ""),
      ...invitationDates(row),
      snoozedUntil: row.snoozedUntil && row.snoozedUntil.getTime() > now ? row.snoozedUntil.toISOString() : null,
    }));
  }

  return {
    v: FAMILY_CONTRACT_VERSION,
    switches: getFamilySwitches(),
    account: {
      canOwn: !guest && !review,
      canJoin: !guest && !review,
      reviewAccount: review,
      hasPin: (await profilesWithPin([caller.userId])).has(caller.userId),
      personalSession: caller.personal,
    },
    owned,
    memberships,
    incoming,
    limits: { maxProfiles: FAMILY_MAX_PROFILES, maxGuests: FAMILY_MAX_GUESTS },
  };
}
