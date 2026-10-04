/**
 * La Famille — les ROUTES et qui peut les appeler. Une seule table : le
 * serveur en tire ses chemins et sa garde d'appelant (aucun chemin écrit deux
 * fois), les clients leurs URL, la sécurité ses tests d'attaque.
 *
 * MIROIR : `apps/backend/src/family/familyRoutes.ts`, octet pour octet (voir
 * l'en-tête de `familyContract.ts`).
 *
 * # Les appelants
 *
 * - `personal` : une session PERSONNELLE — le jeton Jellyfin du web, du
 *   bureau, du mobile (cookie ou `Bearer`). Jamais un jeton d'appareil jumelé,
 *   jamais une session « voir en tant que ».
 * - `ownerTv` : la session de profil du PROPRIÉTAIRE de la famille, sur une
 *   TV de la famille, « Gérer les profils » ouvert par SON PIN
 *   (`tvManageUnlock` ; sans PIN, ouvert d'office).
 * - `memberTv` (v2) : la même chose pour un MEMBRE — ses droits seulement :
 *   voir la famille, créer et supprimer SES invités s'il en a le droit.
 * - `tvProfile` : une session de profil d'une TV, quel qu'en soit le profil.
 * - `tvPairing` : le jeton de jumelage d'une TV passée aux profils — il ne
 *   sert QU'À lister les profils et à en ouvrir un (et à se déjumeler).
 * - `tvLegacy` : le jeton d'appareil d'une TV d'avant les profils — seulement
 *   pour l'échange (`tvEnroll`).
 * - `admin` : un administrateur, en session personnelle.
 *
 * L'acteur se déduit TOUJOURS du jeton, jamais d'un identifiant du corps ou
 * de la query. Aucune route ne prend d'identifiant de famille pour AGIR :
 * elles visent LA famille du porteur (il n'en a qu'une, propriétaire ou
 * membre). Le rôle se juge dans le service : un membre sur un geste de
 * propriétaire reçoit `family.not_owner`.
 *
 * v2, à l'implémentation : `overview`, `createGuest` et `deleteGuest`
 * s'ouvrent à `memberTv` (un membre gère SES invités depuis sa TV) ; la table
 * le dira avec le serveur qui le fait.
 *
 * Deux routes existantes changent de sens pour la TV (docs/FAMILLE.md) :
 * `POST /api/pair/self/revoke` porté par le jeton de jumelage DÉJUMELLE la TV
 * (ses sessions de profil avec) ; porté par un jeton de session de profil, il
 * ne ferme QUE cette session (« Changer de profil »).
 */

export type FamilyCaller = "personal" | "ownerTv" | "memberTv" | "tvProfile" | "tvPairing" | "tvLegacy" | "admin";

export type FamilyHttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface FamilyRouteSpec {
  method: FamilyHttpMethod;
  /** Chemin complet ; les paramètres en `:nom`. */
  path: string;
  callers: readonly FamilyCaller[];
  /** Borne par adresse IP ; absente : la borne générale du serveur. */
  rateLimit?: { max: number; windowMs: number };
}

const MINUTE = 60_000;
const HOUR = 3_600_000;

export const FAMILY_ROUTES = {
  /** → `FamilyOverviewDto`. */
  overview: { method: "GET", path: "/api/family", callers: ["personal", "ownerTv"] },
  /** `DissolveBody` → `{ dissolved: true }`. Le propriétaire seul : membres
   *  sortis, invités supprimés de Jellyfin (tous, quel que soit leur créateur). */
  dissolve: { method: "DELETE", path: "/api/family", callers: ["personal"], rateLimit: { max: 5, windowMs: HOUR } },
  /** `SetPinBody` → `{ hasPin }`. Le PIN de CE compte, pour lui-même. */
  setOwnPin: { method: "PUT", path: "/api/family/pin", callers: ["personal"], rateLimit: { max: 10, windowMs: MINUTE } },
  /** `CreateGuestBody` → `FamilyProfileDto`. Le propriétaire, ou un membre qui
   *  en a le droit (`family.guest_right_required` sinon) : l'invité entre dans
   *  la famille PARTAGÉE, `createdBy` = son créateur. Un compte sans famille
   *  crée la sienne au passage ; un membre, jamais. */
  createGuest: {
    method: "POST",
    path: "/api/family/guests",
    callers: ["personal", "ownerTv"],
    rateLimit: { max: 10, windowMs: HOUR },
  },
  /** → `{ deleted: true }`. Le propriétaire : tout invité ; un membre : ceux
   *  qu'il a créés (`family.not_owner` sinon). Son compte Jellyfin est
   *  supprimé (sa lecture est perdue). */
  deleteGuest: { method: "DELETE", path: "/api/family/guests/:userId", callers: ["personal", "ownerTv"] },
  /** `SetPinBody` → `{ hasPin }`. Le PIN d'un invité : le propriétaire, ou le
   *  membre qui l'a créé. */
  setGuestPin: {
    method: "PUT",
    path: "/api/family/guests/:userId/pin",
    callers: ["personal"],
    rateLimit: { max: 10, windowMs: MINUTE },
  },
  /** → `{ removed: true }`. Le membre sort ; son compte Jellyfin n'est jamais touché. */
  removeMember: { method: "DELETE", path: "/api/family/members/:userId", callers: ["personal", "ownerTv"] },
  /** `SetMemberRightsBody` → `FamilyMemberRights`. Le propriétaire règle les
   *  droits d'un membre (v2). Retirer un droit ne supprime rien. */
  setMemberRights: {
    method: "PUT",
    path: "/api/family/members/:userId/rights",
    callers: ["personal", "ownerTv"],
    rateLimit: { max: 30, windowMs: MINUTE },
  },
  /** `?q=` → `FamilyCandidateDto[]`. v2 : TOUS les comptes du serveur, cachés
   *  de l'écran de connexion compris, affinés par la saisie ; jamais un invité,
   *  un compte désactivé ni soi-même. Déjà dans une famille : `in_family`,
   *  pas invitable. Le propriétaire (ou un compte sans famille) seulement. */
  candidates: {
    method: "GET",
    path: "/api/family/candidates",
    callers: ["personal", "ownerTv"],
    rateLimit: { max: 30, windowMs: MINUTE },
  },
  /** `InviteBody` → `OutgoingInvitationDto`. Le propriétaire seul — un compte
   *  sans famille crée la sienne au passage, un membre jamais
   *  (`family.not_owner`). La cible n'est dans aucune famille
   *  (`family.already_in_family`). */
  invite: {
    method: "POST",
    path: "/api/family/invitations",
    callers: ["personal", "ownerTv"],
    rateLimit: { max: 20, windowMs: HOUR },
  },
  // Les gestes sur une invitation portent son identifiant dans le CORPS
  // (`InvitationActionBody`) : le serveur journalise ses URL.
  /** → `{ cancelled: true }`. Le propriétaire retire une invitation en attente. */
  cancelInvite: { method: "POST", path: "/api/family/invitations/cancel", callers: ["personal", "ownerTv"] },
  /** → `FamilyMembershipDto`. Le destinataire, en session personnelle, s'il
   *  n'est dans aucune famille (`family.already_in_family`) ; ses autres
   *  invitations en attente sont closes. */
  acceptInvite: { method: "POST", path: "/api/family/invitations/accept", callers: ["personal"] },
  /** → `{ declined: true }`. */
  declineInvite: { method: "POST", path: "/api/family/invitations/decline", callers: ["personal"] },
  /** → `IncomingInvitationDto`. « Plus tard » : l'affiche se tait, la cloche garde. */
  snoozeInvite: { method: "POST", path: "/api/family/invitations/snooze", callers: ["personal"] },
  /** → `{ left: true }`. Un membre quitte SA famille ; le propriétaire ne la
   *  quitte pas, il la dissout (`family.owner_must_dissolve`). */
  leave: { method: "POST", path: "/api/family/memberships/:familyId/leave", callers: ["personal"] },
  /** → `TvEnrollResponse`. L'échange, une fois : la TV passe aux profils. */
  tvEnroll: {
    method: "POST",
    path: "/api/family/tv/enroll",
    callers: ["tvLegacy", "tvPairing"],
    rateLimit: { max: 10, windowMs: HOUR },
  },
  /** → `TvProfilesDto`. */
  tvProfiles: { method: "GET", path: "/api/family/tv/profiles", callers: ["tvPairing"] },
  /** `OpenTvSessionBody` → `TvSessionDto`. Ferme la session de profil précédente de cette TV. */
  tvOpenSession: {
    method: "POST",
    path: "/api/family/tv/sessions",
    callers: ["tvPairing"],
    rateLimit: { max: 30, windowMs: MINUTE },
  },
  /** `ManageUnlockBody` → `ManageUnlockResponse`. Le profil du propriétaire ou
   *  d'un membre, derrière SON PIN : la session gère avec SES droits. */
  tvManageUnlock: {
    method: "POST",
    path: "/api/family/tv/manage/unlock",
    callers: ["tvProfile"],
    rateLimit: { max: 20, windowMs: MINUTE },
  },
  /** → `FamilySwitches`. */
  adminSwitches: { method: "GET", path: "/api/admin/family", callers: ["admin"] },
  /** `Partial<FamilySwitches>` → `FamilySwitches`. Couper coupe les sessions de profil concernées. */
  adminSetSwitches: { method: "PUT", path: "/api/admin/family", callers: ["admin"] },
} as const satisfies Record<string, FamilyRouteSpec>;

export type FamilyRouteName = keyof typeof FAMILY_ROUTES;

/** Le chemin d'une route, paramètres remplis (encodés). Un paramètre manquant
 *  est une faute de programmation : on lève plutôt que d'appeler `/undefined`. */
export function familyPath(name: FamilyRouteName, params: Record<string, string> = {}): string {
  return FAMILY_ROUTES[name].path.replace(/:([A-Za-z]+)/g, (_match, key: string) => {
    const value = params[key];
    if (value === undefined || value === "") throw new Error(`familyPath(${name}) : paramètre « ${key} » manquant`);
    return encodeURIComponent(value);
  });
}

/** Le préfixe sous lequel le serveur range ces routes, et le reste du chemin. */
export function splitFamilyPath(path: string): { prefix: "/api/family" | "/api/admin"; rest: string } {
  const prefix = path.startsWith("/api/family") ? "/api/family" : "/api/admin";
  const rest = path.slice(prefix.length);
  return { prefix, rest: rest === "" ? "/" : rest };
}
