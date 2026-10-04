import { getPrisma } from "../db";
import { provisionOwnJellyfinToken } from "../deviceJellyfinToken";
import { revokePairedDevice } from "../deviceRevocation";
import { hashToken, signProfileSessionToken } from "../jwt";
import { FAMILY_CONTRACT_VERSION, FAMILY_MANAGE_UNLOCK_MS, type FamilyRights } from "../../family/familyContract";
import type { ManageUnlockResponse, OpenTvSessionBody, TvProfileDto, TvProfilesDto, TvSessionDto } from "../../family/familyTvContract";
import { familyRightsOf } from "../../family/familyRights";
import { isPickerRequired, isProfileKindAllowed, sameUserId } from "../../family/familyRules";
import { getFamilySwitches, isReviewAccount } from "./familyConfig";
import { FamilyFailure, iso } from "./familyErrors";
import { withFamilyLock } from "./familyLock";
import { checkProfilePin, lockedProfiles, profilesWithPin } from "./familyPins";
import { familyProfiles, findOwnedFamily, fold, jellyfinUserMap, memberKind, profileColor } from "./familyStore";
import type { PairingRow } from "./familyTvEnroll";
import { syncGuestPolicy } from "./guestAccounts";

/**
 * « Qui regarde ? » et les sessions de profil de l'Apple TV (docs/FAMILLE.md).
 * Une TV montre la famille de SON propriétaire — le compte qui l'a jumelée —
 * et n'ouvre jamais le profil d'une autre famille (SEC-F-08/09). Le PIN se
 * vérifie ICI ; « Rester sur ce profil » l'épargne au profil choisi, jamais
 * pendant un blocage. Une seule session de profil par TV.
 */

export async function listTvProfiles(pairing: PairingRow, now: number): Promise<TvProfilesDto> {
  const switches = getFamilySwitches();
  const users = await jellyfinUserMap();
  const ownerId = pairing.jellyfinUserId;
  const family = await findOwnedFamily(ownerId);
  const rows = (family ? await familyProfiles(family.id) : []).filter((row) => {
    if (!isProfileKindAllowed(memberKind(row), switches)) return false;
    // Un compte désactivé (ou disparu) dans Jellyfin ne s'ouvre plus.
    const account = users?.get(fold(row.userId));
    return users === null || (account !== undefined && !account.isDisabled);
  });
  const ids = [ownerId, ...rows.map((row) => row.userId)];
  const [pins, locks, review] = await Promise.all([profilesWithPin(ids), lockedProfiles(ids, now), isReviewAccount(ownerId)]);
  const ownerName = users?.get(fold(ownerId))?.name ?? family?.ownerName ?? pairing.username;
  // Seul le compte de la TV gère, et jamais le compte de démonstration.
  const ownerManage: FamilyRights | null = review ? null : familyRightsOf("owner", null, switches);
  const dto = (
    userId: string,
    kind: TvProfileDto["kind"],
    name: string,
    color: string | null,
    imageTag: string | null,
    createdBy: string | null,
  ): TvProfileDto => {
    const until = locks.get(userId);
    return {
      userId,
      kind,
      name,
      color: profileColor(color, userId),
      hasPin: pins.has(userId),
      imageTag,
      lockedUntil: until ? iso(until) : null,
      createdBy,
      manage: kind === "owner" ? ownerManage : null,
    };
  };
  const profiles = [
    dto(ownerId, "owner", ownerName, family?.ownerColor ?? null, users?.get(fold(ownerId))?.imageTag ?? null, null),
    ...rows
      .sort((a, b) => Number(a.kind === "guest") - Number(b.kind === "guest"))
      .map((row) => {
        const guest = row.kind === "guest";
        const name = guest ? row.displayName : users?.get(fold(row.userId))?.name ?? row.displayName;
        const image = guest ? null : users?.get(fold(row.userId))?.imageTag ?? null;
        return dto(row.userId, memberKind(row), name, row.color, image, guest ? row.createdBy ?? ownerId : null);
      }),
  ];
  const sticky = profiles.find((profile) => pairing.stickyProfileId && sameUserId(profile.userId, pairing.stickyProfileId));
  return {
    v: FAMILY_CONTRACT_VERSION,
    switches,
    pairedBy: { userId: ownerId, name: ownerName },
    owner: { userId: ownerId, name: ownerName },
    profiles,
    stickyProfileId: sticky?.userId ?? null,
    pickerRequired: isPickerRequired(profiles.length),
    canManage: ownerManage !== null,
  };
}

/** Pourquoi un profil n'est pas ouvrable sur cette TV. */
async function unavailable(pairing: PairingRow, profileId: string): Promise<FamilyFailure> {
  const switches = getFamilySwitches();
  const family = await findOwnedFamily(pairing.jellyfinUserId);
  const row = family ? (await familyProfiles(family.id)).find((entry) => sameUserId(entry.userId, profileId)) : undefined;
  if (row && !switches.families) return new FamilyFailure("family.disabled", "Familles coupées par l'administration");
  if (row?.kind === "guest" && !switches.guests) return new FamilyFailure("family.guests_disabled", "Profils invités coupés par l'administration");
  return new FamilyFailure("family.profile_unavailable", "Profil indisponible sur cette TV");
}

export async function openTvSession(pairing: PairingRow, body: OpenTvSessionBody, now: number): Promise<TvSessionDto> {
  return withFamilyLock(`tv:${pairing.id}`, async () => {
    const listing = await listTvProfiles(pairing, now);
    const profile = listing.profiles.find((entry: TvProfileDto) => sameUserId(entry.userId, body.profileId));
    if (!profile) throw await unavailable(pairing, body.profileId);
    if (profile.lockedUntil) {
      throw new FamilyFailure("family.pin_locked", "Profil bloqué : trop d'essais", { lockedUntil: profile.lockedUntil });
    }
    const remembered = listing.stickyProfileId !== null && sameUserId(listing.stickyProfileId, profile.userId);
    if (!remembered) await checkProfilePin({ pairingId: pairing.id, userId: profile.userId, pin: body.pin, now });
    if (profile.kind === "guest") void syncGuestPolicy(profile.userId, pairing.jellyfinUserId);

    const prisma = getPrisma();
    // Une seule session de profil par TV : la précédente se ferme.
    const previous = await prisma.pairedDevice.findMany({ where: { parentId: pairing.id }, select: { id: true } });
    for (const session of previous) await revokePairedDevice({ id: session.id }, "family", { profileEnd: "replaced" });

    const token = await signProfileSessionToken({ userId: profile.userId, username: profile.name, pairingId: pairing.id });
    await prisma.pairedDevice.create({
      data: {
        name: pairing.name,
        jellyfinUserId: profile.userId,
        username: profile.name,
        tokenHash: hashToken(token),
        parentId: pairing.id,
        profileKind: profile.kind,
      },
    });
    const remember = body.remember === true;
    await prisma.pairedDevice.update({
      where: { id: pairing.id },
      data: { stickyProfileId: remember ? profile.userId : null, lastSeen: new Date(now) },
    });
    // Son propre jeton Jellyfin (Quick Connect), sur l'identifiant de CETTE session.
    provisionOwnJellyfinToken(token, { jellyfinUserId: profile.userId, name: pairing.name });
    console.log(`[family] Session de profil ouverte sur la TV ${pairing.id} (${profile.kind})`);
    return { token, user: { id: profile.userId, name: profile.name }, profile, remembered: remember };
  });
}

/** « Gérer les profils » : la session du PROPRIÉTAIRE seulement, PIN compris (SEC-F-18). */
export async function unlockManage(sessionTokenHash: string, pin: string | undefined, now: number): Promise<ManageUnlockResponse> {
  const prisma = getPrisma();
  const session = await prisma.pairedDevice.findUnique({ where: { tokenHash: sessionTokenHash } });
  const pairing = session?.parentId ? await prisma.pairedDevice.findUnique({ where: { id: session.parentId } }) : null;
  if (!session || !pairing || session.profileKind !== "owner" || !sameUserId(session.jellyfinUserId, pairing.jellyfinUserId)) {
    throw new FamilyFailure("family.not_owner", "Réservé au profil du propriétaire");
  }
  if (await isReviewAccount(pairing.jellyfinUserId)) throw new FamilyFailure("family.review_account", "Compte de démonstration");
  await checkProfilePin({ pairingId: pairing.id, userId: pairing.jellyfinUserId, pin, now });
  const until = now + FAMILY_MANAGE_UNLOCK_MS;
  await prisma.pairedDevice.update({ where: { id: session.id }, data: { manageUntil: new Date(until) } });
  return { unlockedUntil: iso(until), rights: familyRightsOf("owner", null, getFamilySwitches()) };
}
