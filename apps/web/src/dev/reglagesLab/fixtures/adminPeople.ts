/**
 * Les COMPTES vus de l'administration : la liste (`/api/admin/users`), les droits de chacun
 * (fiche d'un compte : droits Jellyfin, Octave, création de famille), les droits hors ligne
 * (`/api/admin/downloads/users`) et les interrupteurs de la Famille (`/api/admin/family*`).
 *
 * Huit comptes : deux administrateurs (Camille, Noé), un désactivé (Hugo), une qui ne s'est
 * jamais connectée (Océane), le compte du code de provisionnement (`tv-demo`). Les INVITÉS de
 * la Famille n'y sont pas, comme sur un vrai serveur (`withoutFamilyGuests`) : ils ne
 * paraissent que dans les sessions. État en mémoire : un interrupteur basculé se relit.
 * Formes : `userListModel.ts`, `userRightsContract.ts`, `familyRoles.ts`, `familyPickerContract.ts`.
 */

import type {
  AccountFamilyRightsDto, FamilyAdminSwitchesDto, FamilyCreationDefaults, FamilyCreationRights, FamilyLaunchPolicy, UserRights,
  UserRightsOptions,
} from "@tentacle-tv/shared";
import type { LabRoute } from "../labFetch";
import { labAgo } from "./accountPairing";
import type { AdminState } from "./adminServer";
import { PARENTAL_OPTIONS } from "./familySeed";
import { LAB_LIBRARIES } from "./settingsJellyfin";
import { record, type LabRequest } from "./settingsShared";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

interface LabAccount {
  id: string;
  name: string;
  admin: boolean;
  disabled: boolean;
  /** Dernière activité, il y a tant de ms ; `null` : jamais. */
  activeAgo: number | null;
  loginAgo: number | null;
  downloads: boolean;
  conversion: boolean;
  /** `null` : toutes les bibliothèques. */
  folders: string[] | null;
}

const account = (id: string, name: string, activeAgo: number | null, more: Partial<LabAccount> = {}): LabAccount => ({
  id, name, admin: false, disabled: false, activeAgo, loginAgo: activeAgo === null ? null : activeAgo + 3 * HOUR,
  downloads: true, conversion: true, folders: null, ...more,
});

function seedAccounts(state: AdminState): LabAccount[] {
  const camille = account("u-camille", "Camille", 2 * MINUTE, { admin: true });
  if (state === "empty") return [camille];
  return [
    camille,
    account("u-noe", "Noé", 5 * HOUR, { admin: true }),
    account("u-lea", "Léa", 12 * MINUTE),
    account("u-malik", "Malik", 4 * MINUTE, { conversion: false, folders: ["lib-films", "lib-series"] }),
    account("u-ines", "Inès", 2 * DAY, { downloads: false, conversion: false }),
    account("u-hugo", "Hugo", 74 * DAY, { disabled: true, downloads: false, conversion: false, folders: ["lib-films"] }),
    account("u-oceane", "Océane", null, { folders: ["lib-films", "lib-animes"] }),
    account("u-tv-demo", "tv-demo", 9 * DAY, { downloads: false, conversion: false }),
  ];
}

const userRow = (a: LabAccount) => ({
  id: a.id, name: a.name, hasAvatar: false, imageTag: null,
  lastActivityDate: a.activeAgo === null ? null : labAgo(a.activeAgo),
  lastLoginDate: a.loginAgo === null ? null : labAgo(a.loginAgo),
  isAdministrator: a.admin, isDisabled: a.disabled,
});

const downloadRow = (a: LabAccount) => ({
  id: a.id, name: a.name, isAdministrator: a.admin, enableContentDownloading: a.downloads, enableMediaConversion: a.conversion,
  enableAllFolders: a.folders === null, enabledFoldersCount: a.folders?.length ?? 0,
});

/** Les droits complets d'un compte, tels que Jellyfin les tient. */
function rightsOf(a: LabAccount, extra: Partial<UserRights>): UserRights {
  return {
    isAdministrator: a.admin, isDisabled: a.disabled, enableRemoteAccess: true, maxActiveSessions: a.admin ? 0 : 3, loginAttemptsBeforeLockout: 0,
    enableAllFolders: a.folders === null, enabledFolders: a.folders ?? [],
    maxParentalRating: null, maxParentalSubRating: null, blockUnratedItems: [], blockedTags: [], allowedTags: [], accessSchedules: [],
    enableMediaPlayback: true, enableAudioPlaybackTranscoding: true, enableVideoPlaybackTranscoding: true, enablePlaybackRemuxing: true,
    forceRemoteSourceTranscoding: false, remoteClientBitrateLimit: a.admin ? 0 : 20_000_000, syncPlayAccess: "CreateAndJoinGroups",
    enableContentDownloading: a.downloads, enableMediaConversion: a.conversion,
    enableContentDeletion: a.admin, enableContentDeletionFromFolders: [], enablePublicSharing: true,
    ...extra,
  };
}

const RIGHTS_OPTIONS: UserRightsOptions = {
  libraries: LAB_LIBRARIES.map((library) => ({ id: library.id, name: library.name, collectionType: library.collectionType ?? null })),
  parentalRatings: PARENTAL_OPTIONS.parentalRatings,
  unratedItemTypes: ["Movie", "Trailer", "Series", "Music"],
  knownTags: PARENTAL_OPTIONS.knownTags,
};

const FAMILY_PLACE: Record<string, AccountFamilyRightsDto["family"]> = {
  "u-camille": { role: "owner", ownerName: "Camille", parent: true },
  "u-noe": { role: "member", ownerName: "Camille", parent: true },
};

const userIdIn = (url: URL): string => decodeURIComponent(url.pathname.split("/")[4] ?? "");

export function peopleRoutes(state: AdminState): readonly LabRoute[] {
  const accounts = seedAccounts(state);
  const find = (id: string) => accounts.find((entry) => entry.id === id) ?? accounts[0];
  const extras = new Map<string, Partial<UserRights>>();
  const octave = new Map<string, boolean>([["u-hugo", false], ["u-tv-demo", false]]);
  const creation = new Map<string, FamilyCreationRights>([["u-lea", { createFamily: "allow", createGuests: "inherit", grantGuestRequests: "inherit" }]]);

  const switches: FamilyAdminSwitchesDto = { families: true, guests: true, guestRequests: true, requestExtension: true };
  const defaults: FamilyCreationDefaults = { createFamily: true, createGuests: true, grantGuestRequests: false };
  const policy: FamilyLaunchPolicy = {
    desktop: { mode: "choice", defaultOn: true }, tv: { mode: "choice" },
    enabled: true, platforms: { desktop: true, web: false, mobile: true, tv: true },
  };

  const rightsDto = (id: string) => {
    const target = find(id);
    return { userId: target.id, name: target.name, rights: rightsOf(target, extras.get(target.id) ?? {}), readAt: labAgo(0) };
  };
  const familyRights = (id: string): AccountFamilyRightsDto => {
    const target = find(id);
    const rights = creation.get(target.id) ?? { createFamily: "inherit", createGuests: "inherit", grantGuestRequests: "inherit" };
    const pick = (value: FamilyCreationRights["createFamily"] | undefined, fallback: boolean) =>
      target.admin || (value === "allow" ? true : value === "deny" ? false : fallback);
    return {
      userId: target.id, rights, defaults,
      allowed: {
        createFamily: pick(rights.createFamily, defaults.createFamily),
        createGuests: pick(rights.createGuests, defaults.createGuests),
        grantGuestRequests: pick(rights.grantGuestRequests, defaults.grantGuestRequests === true),
      },
      requestExtension: true, isAdministrator: target.admin, family: FAMILY_PLACE[target.id] ?? null, restrictedBy: null,
    };
  };

  return [
    { path: "/api/admin/users", reply: () => accounts.map(userRow) },
    { path: "/api/admin/users/rights/options", reply: RIGHTS_OPTIONS },
    { path: /^\/api\/admin\/users\/[^/]+\/rights$/, reply: ({ url }: LabRequest) => rightsDto(userIdIn(url)) },
    {
      method: "PATCH", path: /^\/api\/admin\/users\/[^/]+\/rights$/,
      reply: ({ url, body }: LabRequest) => {
        const target = find(userIdIn(url));
        const patch = record(body) as Partial<UserRights>;
        extras.set(target.id, { ...extras.get(target.id), ...patch });
        // Ce que la liste et les droits hors ligne montrent aussi.
        if (typeof patch.isAdministrator === "boolean") target.admin = patch.isAdministrator;
        if (typeof patch.isDisabled === "boolean") target.disabled = patch.isDisabled;
        if (typeof patch.enableContentDownloading === "boolean") target.downloads = patch.enableContentDownloading;
        if (typeof patch.enableMediaConversion === "boolean") target.conversion = patch.enableMediaConversion;
        return rightsDto(target.id);
      },
    },
    { path: /^\/api\/admin\/users\/[^/]+\/octave$/, reply: ({ url }: LabRequest) => ({ userId: userIdIn(url), access: octave.get(userIdIn(url)) ?? true }) },
    {
      method: "PUT", path: /^\/api\/admin\/users\/[^/]+\/octave$/,
      reply: ({ url, body }: LabRequest) => {
        const id = userIdIn(url);
        if (typeof record(body).access === "boolean") octave.set(id, record(body).access === true);
        return { userId: id, access: octave.get(id) ?? true };
      },
    },
    // Le labo ne change pas de compte : « Voir en tant que » est refusé, l'écran le dit.
    { method: "POST", path: "/api/admin/impersonate", status: 403, reply: { message: "Le labo ne change pas de compte." } },

    { path: "/api/admin/downloads/users", reply: () => accounts.map(downloadRow) },
    {
      method: "PUT", path: /^\/api\/admin\/downloads\/users\/[^/]+$/,
      reply: ({ url, body }: LabRequest) => {
        const target = find(decodeURIComponent(url.pathname.split("/")[5] ?? ""));
        const patch = record(body);
        if (typeof patch.enableContentDownloading === "boolean") target.downloads = patch.enableContentDownloading;
        if (typeof patch.enableMediaConversion === "boolean") target.conversion = patch.enableMediaConversion;
        return downloadRow(target);
      },
    },

    { path: "/api/admin/family", reply: () => switches },
    { method: "PUT", path: "/api/admin/family", reply: ({ body }: LabRequest) => Object.assign(switches, record(body)) },
    { path: "/api/admin/family/creation", reply: () => defaults },
    { method: "PUT", path: "/api/admin/family/creation", reply: ({ body }: LabRequest) => Object.assign(defaults, record(body)) },
    { path: "/api/admin/family/picker", reply: () => policy },
    {
      method: "PUT", path: "/api/admin/family/picker",
      reply: ({ body }: LabRequest) => {
        const input = record(body);
        if (typeof input.enabled === "boolean") policy.enabled = input.enabled;
        if (policy.platforms) Object.assign(policy.platforms, record(input.platforms));
        Object.assign(policy.desktop, record(input.desktop));
        Object.assign(policy.tv, record(input.tv));
        return policy;
      },
    },
    { path: /^\/api\/admin\/family\/accounts\/[^/]+$/, reply: ({ url }: LabRequest) => familyRights(decodeURIComponent(url.pathname.split("/")[5] ?? "")) },
    {
      method: "PUT", path: /^\/api\/admin\/family\/accounts\/[^/]+$/,
      reply: ({ url, body }: LabRequest) => {
        const id = decodeURIComponent(url.pathname.split("/")[5] ?? "");
        creation.set(id, { ...familyRights(id).rights, ...(record(body) as Partial<FamilyCreationRights>) });
        return familyRights(id);
      },
    },
  ];
}
