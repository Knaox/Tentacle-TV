import { FAMILY_CONTRACT_VERSION, type FamilySwitches, type FamilyRights } from "../../family/familyContract";
import type {
  FamilyPickerPlatform,
  PickProfileBody,
  PickedProfileDto,
  PickerPreferenceDto,
  PickerProfileDto,
  PickerProfilesDto,
  SetPickerPreferenceBody,
} from "../../family/familyPickerContract";
import type { TvProfileDto } from "../../family/familyTvContract";
import { canManageGuest, familyRightsOf } from "../../family/familyRights";
import { isPickerRequired, sameUserId } from "../../family/familyRules";
import { isReviewAccount } from "./familyConfig";
import { FamilyFailure } from "./familyErrors";
import { isFamilyGuest } from "./familyGuestMarkers";
import { withFamilyLock } from "./familyLock";
import { familyUpdate } from "./familyNotify";
import { checkProfilePin } from "./familyPins";
import { closeProfileSessions, startProfileSession } from "./familyProfileSession";
import { currentProfileOf, ensurePickerHost, findPickerHost, pickerHostLock, touchPickerHost } from "./familyPickerHosts";
import { desktopAtLaunchByDefault, getFamilyLaunchPolicy } from "./familyLaunchPolicy";
import { readPickerPreference, writePickerPreference } from "./familyPickerPreference";
import { unavailableFor, visibleProfiles } from "./familyTv";
import { syncGuestPolicy } from "./guestPolicySync";
import { syncMemberParental } from "./memberParentalSync";

/**
 * « Qui regarde ? » sur le BUREAU (docs/FAMILLE.md, « Le bureau ») — joué
 * par la SESSION PERSONNELLE de l'appareil, et elle seule (`FAMILY_ROUTES`,
 * `picker*`). Les profils sont ceux de sa TV (`visibleProfiles`) ; le PIN se
 * vérifie ICI, compté par profil tous appareils confondus.
 *
 * - SON profil : la session personnelle reprend, derrière SON PIN — la
 *   session de profil de l'appareil, s'il y en avait une, est fermée ; aucun
 *   jeton n'est rendu (l'appareil a déjà le sien).
 * - Un AUTRE profil : une session de profil, ligne enfant de l'HÔTE de cet
 *   appareil (`familyPickerHosts.ts`), aux règles des TV ; une seule par hôte.
 *
 * Un invité n'a pas de « Qui regarde ? » à lui (il est un profil des autres) ;
 * le compte de démonstration n'ouvre que le sien.
 */

export interface PickerCaller {
  userId: string;
  username: string;
  /** Le jeton de la session personnelle : son hôte en dérive. */
  token: string;
}

/** Ce que le compte de la session personnelle peut dans SA famille (rôle lu sur sa ligne). */
function accountRights(profiles: readonly TvProfileDto[], account: string, switches: FamilySwitches): FamilyRights {
  const own = profiles.find((profile) => sameUserId(profile.userId, account));
  const role = own?.kind === "owner" ? "owner" : own?.kind === "member" ? "member" : null;
  // Ses droits de gestion tels que la liste les dit (un parent gère tous les invités).
  return own?.manage ?? familyRightsOf(role, null, switches);
}

function toPickerProfile(profile: TvProfileDto, account: string, rights: FamilyRights): PickerProfileDto {
  return {
    userId: profile.userId,
    kind: profile.kind,
    name: profile.name,
    color: profile.color,
    hasPin: profile.hasPin,
    imageTag: profile.imageTag,
    lockedUntil: profile.lockedUntil,
    createdBy: profile.createdBy,
    personal: sameUserId(profile.userId, account),
    // Les mêmes droits que son PIN : la photo d'un invité, l'appareil l'habille par la session personnelle.
    photoEditable: profile.kind === "guest" && canManageGuest(rights, profile.createdBy, account),
  };
}

async function refuseGuest(userId: string): Promise<void> {
  if (await isFamilyGuest(userId)) throw new FamilyFailure("family.guest_account", "Un invité est un profil des autres");
}

export async function listPickerProfiles(caller: PickerCaller, platform: FamilyPickerPlatform, now: number): Promise<PickerProfilesDto> {
  await refuseGuest(caller.userId);
  const [{ switches, profiles }, host] = await Promise.all([
    visibleProfiles(caller.userId, caller.username, now),
    findPickerHost(caller.token),
  ]);
  const policy = getFamilyLaunchPolicy();
  const own = profiles.find((profile) => sameUserId(profile.userId, caller.userId));
  const account = { userId: own?.userId ?? caller.userId, name: own?.name ?? caller.username };
  const rights = accountRights(profiles, caller.userId, switches);
  let currentProfileId = account.userId;
  if (host) {
    const active = await currentProfileOf(host.id);
    if (active) currentProfileId = profiles.find((profile) => sameUserId(profile.userId, active))?.userId ?? active;
    await touchPickerHost(host.id, now);
  }
  return {
    v: FAMILY_CONTRACT_VERSION,
    platform,
    switches,
    account,
    profiles: profiles.map((profile) => toPickerProfile(profile, caller.userId, rights)),
    currentProfileId,
    pickerRequired: isPickerRequired(profiles.length),
    // Le bureau décide par APPAREIL dans ce cadre ; `atLaunch` sert les bureaux d'avant (ordinateur « jamais choisi »).
    atLaunch: desktopAtLaunchByDefault(policy),
    launchPolicy: policy.desktop,
  };
}

export function pickProfile(caller: PickerCaller, body: PickProfileBody, now: number): Promise<PickedProfileDto> {
  // Un geste à la fois par appareil : deux clics ne laissent jamais deux
  // sessions, et un choix ne survit pas à la déconnexion qui le croise.
  return withFamilyLock(pickerHostLock(caller.token), () => pickNow(caller, body, now));
}

async function pickNow(caller: PickerCaller, body: PickProfileBody, now: number): Promise<PickedProfileDto> {
  await refuseGuest(caller.userId);
  const personal = sameUserId(body.profileId, caller.userId);
  if (!personal && (await isReviewAccount(caller.userId))) {
    throw new FamilyFailure("family.review_account", "Compte de démonstration : aucun autre profil");
  }
  const { profiles, switches } = await visibleProfiles(caller.userId, caller.username, now);
  const profile = profiles.find((entry) => sameUserId(entry.userId, body.profileId));
  if (!profile) throw await unavailableFor(caller.userId, body.profileId);
  if (profile.lockedUntil) throw new FamilyFailure("family.pin_locked", "Profil bloqué : trop d'essais", { lockedUntil: profile.lockedUntil });

  const existing = await findPickerHost(caller.token);
  await checkProfilePin({ pairingId: existing?.id ?? null, userId: profile.userId, pin: body.pin, now });
  const dto = toPickerProfile(profile, caller.userId, accountRights(profiles, caller.userId, switches));

  if (personal) {
    if (existing) {
      await closeProfileSessions(existing.id, "closed");
      await touchPickerHost(existing.id, now);
    }
    return { personal: true, profile: dto };
  }

  const host = await ensurePickerHost(caller.token, caller, body.platform, body.deviceName, now);
  // L'invité suit la politique de SON créateur, quel que soit l'appareil qui l'ouvre.
  if (profile.kind === "guest") void syncGuestPolicy(profile.userId, profile.createdBy ?? caller.userId);
  if (profile.kind === "member") void syncMemberParental(profile.userId);
  const token = await startProfileSession(host, profile);
  console.log(`[family] Session de profil ouverte sur l'hôte ${host.id} (${host.platform}, ${profile.kind})`);
  return { personal: false, token, user: { id: profile.userId, name: profile.name }, profile: dto };
}

export async function getPickerPreference(caller: PickerCaller): Promise<PickerPreferenceDto> {
  await refuseGuest(caller.userId);
  return readPickerPreference(caller.userId);
}

/** La préférence du COMPTE : ses autres appareils l'apprennent par
 *  `family:update` (ils relisent la Famille, et elle avec). */
export async function setPickerPreference(caller: PickerCaller, body: SetPickerPreferenceBody): Promise<PickerPreferenceDto> {
  await refuseGuest(caller.userId);
  if (await isReviewAccount(caller.userId)) throw new FamilyFailure("family.review_account", "Compte de démonstration");
  const preference = await writePickerPreference(caller.userId, body.platform, body.atLaunch);
  familyUpdate([caller.userId], "family");
  console.log(`[family] « Qui regarde ? » au lancement (${body.platform}) : ${body.atLaunch ? "oui" : "non"}`);
  return preference;
}
