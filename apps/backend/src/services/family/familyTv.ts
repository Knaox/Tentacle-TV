import { getPrisma } from "../db";
import { FAMILY_CONTRACT_VERSION, FAMILY_MANAGE_UNLOCK_MS, type FamilyProfileKind, type FamilySwitches } from "../../family/familyContract";
import type { ManageUnlockResponse, OpenTvSessionBody, TvProfileDto, TvProfilesDto, TvSessionDto } from "../../family/familyTvContract";
import { familyRightsOf } from "../../family/familyRights";
import { isPickerRequired, sameUserId } from "../../family/familyRules";
import { getFamilySwitches, isReviewAccount } from "./familyConfig";
import { FamilyFailure, iso } from "./familyErrors";
import { withFamilyLock } from "./familyLock";
import { checkProfilePin, lockedProfiles, profilesWithPin } from "./familyPins";
import { startProfileSession } from "./familyProfileSession";
import { familyOf, familyProfiles, fold, jellyfinUserMap, memberKind, profileColor, type MemberRow } from "./familyStore";
import type { PairingRow } from "./familyTvEnroll";
import { syncGuestPolicy } from "./guestAccounts";

/**
 * « Qui regarde ? » et les sessions de profil de l'Apple TV (docs/FAMILLE.md).
 * v2 : une TV montre TOUTE la famille du compte qui l'a jumelée — qu'il en
 * soit le propriétaire ou un membre — et n'ouvre jamais le profil d'une autre
 * famille (SEC-F-08/09). Le PIN se vérifie ICI, compté par profil toutes TV
 * confondues ; « Rester sur ce profil » l'épargne au profil choisi, jamais
 * pendant un blocage. Une seule session de profil par TV.
 */

interface TvEntry {
  userId: string;
  kind: FamilyProfileKind;
  row: MemberRow | null;
}

const RANK: Record<FamilyProfileKind, number> = { owner: 0, member: 1, guest: 2 };

/** Ce que la TV de ce compte montre, dans l'ordre : sa famille (propriétaire,
 *  membres, invités — chacun par ordre d'arrivée), filtrée par les
 *  interrupteurs ; sans famille, ou la Famille coupée, le seul compte de la TV. */
export async function tvEntries(account: string, switches: FamilySwitches): Promise<{ entries: TvEntry[]; familyOwner: string | null }> {
  const mine = await familyOf(account);
  if (!mine || !switches.families) {
    return { entries: [{ userId: account, kind: mine?.role ?? "owner", row: mine?.self ?? null }], familyOwner: mine?.family.ownerUserId ?? null };
  }
  const rows = (await familyProfiles(mine.family.id)).filter((row) => row.kind !== "guest" || switches.guests);
  const entries = rows.map((row) => ({ userId: row.userId, kind: memberKind(row), row })).sort((a, b) => RANK[a.kind] - RANK[b.kind]);
  return { entries, familyOwner: mine.family.ownerUserId };
}

/**
 * Les profils que « Qui regarde ? » montre pour ce compte — sur sa TV, ou sur
 * son bureau (`familyPicker.ts`) : la même règle partout. `accountName` sert
 * si ni Jellyfin ni la famille ne nomment le compte.
 */
export async function visibleProfiles(
  account: string,
  accountName: string,
  now: number,
): Promise<{ switches: FamilySwitches; profiles: TvProfileDto[] }> {
  const switches = getFamilySwitches();
  const users = await jellyfinUserMap();
  const { entries, familyOwner } = await tvEntries(account, switches);
  // Un compte désactivé (ou disparu) dans Jellyfin ne s'ouvre plus ; celui de la TV reste.
  const visible = entries.filter((entry) => {
    if (sameUserId(entry.userId, account)) return true;
    const user = users?.get(fold(entry.userId));
    return users === null || (user !== undefined && !user.isDisabled);
  });
  const ids = visible.map((entry) => entry.userId);
  const [pins, locks, review] = await Promise.all([profilesWithPin(ids), lockedProfiles(ids, now), isReviewAccount(account)]);
  const profiles = visible.map((entry): TvProfileDto => {
    const guest = entry.kind === "guest";
    const until = locks.get(entry.userId);
    const jellyfinName = users?.get(fold(entry.userId))?.name;
    return {
      userId: entry.userId,
      kind: entry.kind,
      name: guest ? entry.row?.displayName ?? "" : jellyfinName ?? entry.row?.displayName ?? accountName,
      color: profileColor(entry.row?.color ?? null, entry.userId),
      hasPin: pins.has(entry.userId),
      // Un invité a sa photo depuis la 1.30.0 (`setGuestPhoto`), sur son compte Jellyfin caché.
      imageTag: users?.get(fold(entry.userId))?.imageTag ?? null,
      lockedUntil: until ? iso(until) : null,
      createdBy: guest ? entry.row?.createdBy ?? familyOwner : null,
      guestRights: guest ? { requestTitles: entry.row?.canRequestTitles === true } : null,
      // Ce que ce profil gérerait ici, derrière SON PIN ; jamais un invité, jamais le compte de démonstration.
      manage:
        review || guest
          ? null
          : familyRightsOf(entry.kind === "member" ? "member" : "owner", { createGuests: entry.row?.canCreateGuests === true }, switches),
    };
  });
  return { switches, profiles };
}

export async function listTvProfiles(pairing: PairingRow, now: number): Promise<TvProfilesDto> {
  const account = pairing.jellyfinUserId;
  const { switches, profiles } = await visibleProfiles(account, pairing.username, now);
  const pairedBy = { userId: account, name: profiles.find((profile) => sameUserId(profile.userId, account))?.name ?? pairing.username };
  const sticky = profiles.find((profile) => pairing.stickyProfileId && sameUserId(profile.userId, pairing.stickyProfileId));
  return {
    v: FAMILY_CONTRACT_VERSION,
    switches,
    pairedBy,
    owner: pairedBy,
    profiles,
    stickyProfileId: sticky?.userId ?? null,
    pickerRequired: isPickerRequired(profiles.length),
    canManage: profiles.some((profile) => profile.manage !== null),
  };
}

/** Qui gère depuis une session de profil de cette TV : le propriétaire de la
 *  famille (`ownerTv`), un membre (`memberTv`), ou personne (un invité, un
 *  profil qui n'est plus dans la famille de la TV). */
export async function tvManageRole(userId: string, pairingAccount: string): Promise<"ownerTv" | "memberTv" | null> {
  const { entries } = await tvEntries(pairingAccount, getFamilySwitches());
  const entry = entries.find((candidate) => sameUserId(candidate.userId, userId));
  if (!entry || entry.kind === "guest") return null;
  return entry.kind === "member" ? "memberTv" : "ownerTv";
}

/** Pourquoi un profil n'est pas ouvrable sur l'appareil de ce compte (sa TV, son bureau). */
export async function unavailableFor(account: string, profileId: string): Promise<FamilyFailure> {
  const switches = getFamilySwitches();
  const mine = await familyOf(account);
  const row = mine ? (await familyProfiles(mine.family.id)).find((entry) => sameUserId(entry.userId, profileId)) : undefined;
  if (row && !switches.families) return new FamilyFailure("family.disabled", "Familles coupées par l'administration");
  if (row?.kind === "guest" && !switches.guests) return new FamilyFailure("family.guests_disabled", "Profils invités coupés par l'administration");
  return new FamilyFailure("family.profile_unavailable", "Profil indisponible sur cette TV");
}

export async function openTvSession(pairing: PairingRow, body: OpenTvSessionBody, now: number): Promise<TvSessionDto> {
  return withFamilyLock(`tv:${pairing.id}`, async () => {
    const listing = await listTvProfiles(pairing, now);
    const profile = listing.profiles.find((entry) => sameUserId(entry.userId, body.profileId));
    if (!profile) throw await unavailableFor(pairing.jellyfinUserId, body.profileId);
    if (profile.lockedUntil) {
      throw new FamilyFailure("family.pin_locked", "Profil bloqué : trop d'essais", { lockedUntil: profile.lockedUntil });
    }
    const remembered = listing.stickyProfileId !== null && sameUserId(listing.stickyProfileId, profile.userId);
    if (!remembered) await checkProfilePin({ pairingId: pairing.id, userId: profile.userId, pin: body.pin, now });
    // L'invité suit la politique de SON créateur, quelle que soit la TV qui l'ouvre.
    if (profile.kind === "guest") void syncGuestPolicy(profile.userId, profile.createdBy ?? pairing.jellyfinUserId);

    // Une seule session de profil par TV : la précédente se ferme.
    const token = await startProfileSession(pairing, profile);
    const remember = body.remember === true;
    await getPrisma().pairedDevice.update({
      where: { id: pairing.id },
      data: { stickyProfileId: remember ? profile.userId : null, lastSeen: new Date(now) },
    });
    console.log(`[family] Session de profil ouverte sur la TV ${pairing.id} (${profile.kind})`);
    return { token, user: { id: profile.userId, name: profile.name }, profile, remembered: remember };
  });
}

/** « Gérer les profils » : le propriétaire ou un membre de la famille de la TV,
 *  derrière SON PIN — chacun avec SES droits (SEC-F-18). */
export async function unlockManage(sessionTokenHash: string, pin: string | undefined, now: number): Promise<ManageUnlockResponse> {
  const prisma = getPrisma();
  const session = await prisma.pairedDevice.findUnique({ where: { tokenHash: sessionTokenHash } });
  const pairing = session?.parentId ? await prisma.pairedDevice.findUnique({ where: { id: session.parentId } }) : null;
  if (!session || !pairing) throw new FamilyFailure("family.not_owner", "Réservé à un profil qui gère");
  if ((await isReviewAccount(pairing.jellyfinUserId)) || (await isReviewAccount(session.jellyfinUserId))) {
    throw new FamilyFailure("family.review_account", "Compte de démonstration");
  }
  const listing = await listTvProfiles(pairing, now);
  const profile = listing.profiles.find((entry) => sameUserId(entry.userId, session.jellyfinUserId));
  if (!profile?.manage) throw new FamilyFailure("family.not_owner", "Ce profil ne gère rien sur cette TV");
  await checkProfilePin({ pairingId: pairing.id, userId: profile.userId, pin, now });
  const until = now + FAMILY_MANAGE_UNLOCK_MS;
  await prisma.pairedDevice.update({ where: { id: session.id }, data: { manageUntil: new Date(until) } });
  return { unlockedUntil: iso(until), rights: profile.manage };
}
