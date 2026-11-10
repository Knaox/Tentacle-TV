/**
 * La FAMILLE du labo (`/api/family/*`, contrat `@tentacle-tv/shared` › `family/`) : celle de
 * Camille, PROPRIÉTAIRE — un membre, deux invités, une invitation en attente (`familySeed.ts`).
 * L'état vit en mémoire : créer un invité, poser un code, inviter ou retirer quelqu'un se voit
 * à la relecture de la page.
 */

import {
  FAMILY_CONTRACT_VERSION, FAMILY_MAX_GUESTS, FAMILY_MAX_PROFILES, GUEST_PARENTAL_NONE,
  type FamilyCandidateDto, type FamilyLibrariesDto, type FamilyOverviewDto, type FamilyProfileDto,
  type GuestParentalControls, type OutgoingInvitationDto, type PickerPreferenceDto, type PickerProfileDto,
  type PickerProfilesDto,
} from "@tentacle-tv/shared";
import type { LabRoute } from "../labFetch";
import { LAB_USER } from "./base";
import { ACCOUNTS, ahead, ago, OPEN_CEILING, PARENTAL_OPTIONS, SEED_INVITATIONS, SEED_PROFILES, SWITCHES } from "./familySeed";
import { LAB_LIBRARIES } from "./settingsJellyfin";
import { record, type LabRequest } from "./settingsShared";

let profiles: FamilyProfileDto[] = [...SEED_PROFILES];
let invitations: OutgoingInvitationDto[] = [...SEED_INVITATIONS];
let libraryLimits: Record<string, string[] | null> = { "g-mamie": ["lib-films", "lib-series"] };
let atLaunch = true;

function overview(): FamilyOverviewDto {
  const family = {
    id: "fam-camille",
    role: "owner" as const,
    owner: { userId: LAB_USER.Id, name: LAB_USER.Name },
    profiles,
    pendingInvitations: invitations,
    rights: { manageMembers: true, createGuests: true, manageGuests: "all" as const, manageRoles: true, manageMinors: true },
    createdAt: ago(240),
    since: null,
  };
  return {
    v: FAMILY_CONTRACT_VERSION,
    switches: SWITCHES,
    account: {
      canOwn: true, canJoin: false, reviewAccount: false, hasPin: profiles[0]?.hasPin ?? false, personalSession: true,
      creation: { createFamily: true, createGuests: true, grantGuestRequests: true },
    },
    family,
    owned: { id: family.id, profiles, pendingInvitations: invitations, createdAt: family.createdAt },
    memberships: [],
    incoming: [],
    limits: { maxProfiles: FAMILY_MAX_PROFILES, maxGuests: FAMILY_MAX_GUESTS },
  };
}

function pickerProfiles(url: URL): PickerProfilesDto {
  const platform = url.searchParams.get("platform");
  const list: PickerProfileDto[] = profiles.map((profile) => ({
    userId: profile.userId, kind: profile.kind, name: profile.name, color: profile.color, hasPin: profile.hasPin,
    imageTag: profile.imageTag, lockedUntil: null, createdBy: profile.createdBy, personal: profile.userId === LAB_USER.Id,
    photoEditable: profile.kind === "guest", manage: null, promptsResetAt: profile.promptsResetAt ?? null,
  }));
  return {
    v: FAMILY_CONTRACT_VERSION,
    platform: platform === "desktop" || platform === "mobile" ? platform : "web",
    switches: SWITCHES,
    account: { userId: LAB_USER.Id, name: LAB_USER.Name },
    profiles: list,
    currentProfileId: LAB_USER.Id,
    pickerRequired: list.length >= 2,
    atLaunch,
    launchPolicy: { mode: "choice", defaultOn: true },
    launchAsk: true,
  };
}

const idAfter = (segment: string) => (url: URL): string =>
  decodeURIComponent(new RegExp(`/${segment}/([^/]+)`).exec(url.pathname)?.[1] ?? "");
const guestId = idAfter("guests");
const memberId = idAfter("members");
const profileId = idAfter("profiles");

/** Applique un changement au profil visé ; rend le profil changé (ou rien s'il n'existe pas). */
function patchProfile(userId: string, change: (profile: FamilyProfileDto) => FamilyProfileDto): FamilyProfileDto | undefined {
  profiles = profiles.map((profile) => (profile.userId === userId ? change(profile) : profile));
  return profiles.find((profile) => profile.userId === userId);
}

const hasPinOf = (body: unknown): boolean => typeof record(body).pin === "string";

const setParental = (idOf: (url: URL) => string) => ({ url, body }: LabRequest) => {
  const parental = { ...GUEST_PARENTAL_NONE, ...record(body) } as GuestParentalControls;
  patchProfile(idOf(url), (profile) => ({ ...profile, parental, parentalCeiling: OPEN_CEILING }));
  return { parental, parentalCeiling: OPEN_CEILING };
};

function libraries(userId: string): FamilyLibrariesDto {
  return {
    available: LAB_LIBRARIES.map(({ id, name, collectionType }) => ({ id, name, collectionType })),
    allowed: libraryLimits[userId] ?? null,
  };
}

function candidates(url: URL): FamilyCandidateDto[] {
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  return ACCOUNTS.filter((account) => account.name.toLowerCase().includes(q)).map((account) => ({
    ...account,
    imageTag: null,
    status: invitations.some((invitation) => invitation.inviteeUserId === account.userId)
      ? "invited"
      : account.userId === "u-oceane" ? "in_family" : "available",
  }));
}

export function familyRoutes(): readonly LabRoute[] {
  return [
    { path: "/api/family", reply: overview },
    { method: "DELETE", path: "/api/family", reply: { dissolved: true } },
    {
      method: "PUT",
      path: "/api/family/pin",
      reply: ({ body }: LabRequest) => ({ hasPin: patchProfile(LAB_USER.Id, (profile) => ({ ...profile, hasPin: hasPinOf(body) }))?.hasPin ?? false }),
    },

    // ── Invités ──
    {
      method: "POST",
      path: "/api/family/guests",
      reply: ({ body }: LabRequest) => {
        const input = record(body);
        const guest: FamilyProfileDto = {
          userId: `g-${profiles.length + 1}`, kind: "guest", name: typeof input.name === "string" ? input.name : "Invité",
          color: (input.color as FamilyProfileDto["color"] | undefined) ?? "green", hasPin: false, imageTag: null,
          since: new Date().toISOString(), createdBy: LAB_USER.Id, createdByName: LAB_USER.Name, rights: null,
          guestRights: { requestTitles: false }, parental: { ...GUEST_PARENTAL_NONE }, parentalCeiling: OPEN_CEILING, promptsResetAt: null,
        };
        profiles = [...profiles, guest];
        return guest;
      },
    },
    {
      method: "PUT",
      path: /^\/api\/family\/guests\/[^/]+\/rights$/,
      reply: ({ url, body }: LabRequest) => {
        const requestTitles = record(body).requestTitles === true;
        patchProfile(guestId(url), (profile) => ({ ...profile, guestRights: { requestTitles } }));
        return { requestTitles };
      },
    },
    {
      method: "PUT",
      path: /^\/api\/family\/guests\/[^/]+\/pin$/,
      reply: ({ url, body }: LabRequest) => ({ hasPin: patchProfile(guestId(url), (profile) => ({ ...profile, hasPin: hasPinOf(body) }))?.hasPin ?? false }),
    },
    { method: "PUT", path: /^\/api\/family\/guests\/[^/]+\/photo$/, reply: { imageTag: null } },
    { method: "PUT", path: /^\/api\/family\/guests\/[^/]+\/parental$/, reply: setParental(guestId) },
    {
      method: "DELETE",
      path: /^\/api\/family\/guests\/[^/]+$/,
      reply: ({ url }: LabRequest) => {
        profiles = profiles.filter((profile) => profile.userId !== guestId(url));
        return { deleted: true };
      },
    },
    { path: "/api/family/parental/options", reply: PARENTAL_OPTIONS },

    // ── Membres ──
    {
      method: "PUT",
      path: /^\/api\/family\/members\/[^/]+\/rights$/,
      reply: ({ url, body }: LabRequest) => {
        const createGuests = record(body).createGuests === true;
        patchProfile(memberId(url), (profile) => ({ ...profile, rights: { createGuests } }));
        return { createGuests };
      },
    },
    {
      method: "PUT",
      path: /^\/api\/family\/members\/[^/]+\/role$/,
      reply: ({ url, body }: LabRequest) => {
        const parent = record(body).parent === true;
        patchProfile(memberId(url), (profile) => ({ ...profile, parent }));
        return { parent };
      },
    },
    { method: "PUT", path: /^\/api\/family\/members\/[^/]+\/parental$/, reply: setParental(memberId) },
    {
      method: "DELETE",
      path: /^\/api\/family\/members\/[^/]+$/,
      reply: ({ url }: LabRequest) => {
        profiles = profiles.filter((profile) => profile.userId !== memberId(url));
        return { removed: true };
      },
    },

    // ── Profils : bibliothèques permises, premier passage ──
    { path: /^\/api\/family\/profiles\/[^/]+\/libraries$/, reply: ({ url }: LabRequest) => libraries(profileId(url)) },
    {
      method: "PUT",
      path: /^\/api\/family\/profiles\/[^/]+\/libraries$/,
      reply: ({ url, body }: LabRequest) => {
        const allowed = record(body).allowed;
        libraryLimits = { ...libraryLimits, [profileId(url)]: Array.isArray(allowed) ? allowed.map(String) : null };
        return libraries(profileId(url));
      },
    },
    {
      method: "POST",
      path: /^\/api\/family\/profiles\/[^/]+\/prompts\/reset$/,
      reply: ({ url }: LabRequest) => {
        const promptsResetAt = new Date().toISOString();
        patchProfile(profileId(url), (profile) => ({ ...profile, promptsResetAt }));
        return { promptsResetAt };
      },
    },

    // ── Invitations ──
    { path: "/api/family/candidates", reply: ({ url }: LabRequest) => candidates(url) },
    {
      method: "POST",
      path: "/api/family/invitations",
      reply: ({ body }: LabRequest) => {
        const userId = String(record(body).userId ?? "");
        const invitation: OutgoingInvitationDto = {
          id: `inv-${userId}`, inviteeUserId: userId, inviteeName: ACCOUNTS.find((account) => account.userId === userId)?.name ?? "Compte",
          createdAt: new Date().toISOString(), expiresAt: ahead(7),
        };
        invitations = [...invitations, invitation];
        return invitation;
      },
    },
    {
      method: "POST",
      path: "/api/family/invitations/cancel",
      reply: ({ body }: LabRequest) => {
        invitations = invitations.filter((invitation) => invitation.id !== record(body).id);
        return { cancelled: true };
      },
    },

    // ── « Qui regarde ? » à l'ouverture ──
    { path: "/api/family/picker/profiles", reply: ({ url }: LabRequest) => pickerProfiles(url) },
    { path: "/api/family/picker/preference", reply: (): PickerPreferenceDto => ({ atLaunch: { desktop: atLaunch } }) },
    {
      method: "PUT",
      path: "/api/family/picker/preference",
      reply: ({ body }: LabRequest): PickerPreferenceDto => {
        atLaunch = record(body).atLaunch === true;
        return { atLaunch: { desktop: atLaunch } };
      },
    },
  ];
}
