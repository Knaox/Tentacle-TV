import { answerableInvitations, familyActions, familyGrowth, type FamilyErrorCode, type FamilyOverviewDto, type FamilyRole } from "@tentacle-tv/shared";

/**
 * La page Famille du mobile (v2 : UNE famille par compte, partagée) — ce
 * qu'elle MONTRE, tiré de la vue d'ensemble rendue par le serveur. Le
 * propriétaire invite, règle les droits, retire et dissout ; un membre voit
 * toute la famille, crée des invités si on le lui permet, et quitte ; un
 * compte sans famille répond aux invitations ou crée la sienne. Rien n'y est
 * décidé à la place du serveur : un geste masqué ici serait refusé là-bas.
 * Un geste que l'administration ou le rôle refuse N'EXISTE PAS ici (shared
 * `familyGrowth`) : ni bouton grisé, ni « Créez votre famille ».
 * Module pur : `familyScreenModel.test.ts`.
 */

export type FamilyNoticeKey = "notice.personalOnly" | "notice.disabled" | "notice.guestsDisabled";

/** Les refus que la page dit déjà dans ses encarts. */
const NOTICED = new Set<FamilyErrorCode>(["family.personal_session_required", "family.disabled", "family.guests_disabled"]);

export interface FamilyScreenModel {
  notices: FamilyNoticeKey[];
  /** Les gestes personnels : répondre, inviter, gérer, quitter, son PIN, dissoudre. */
  personal: boolean;
  /** Le rôle de ce compte dans SA famille ; null : il n'en a pas. */
  role: FamilyRole | null;
  showIncoming: boolean;
  /** « Inviter un compte » : le propriétaire, ou qui crée sa famille. */
  showInvite: boolean;
  /** « Ajouter un invité » : le propriétaire, qui crée sa famille, ou un membre qui en a le droit. */
  showAddGuest: boolean;
  /** La section de la famille : la sienne, ou l'appel à la créer s'il peut la fonder. */
  showFamily: boolean;
  /** Inviter / créer un invité : null si permis, sinon le refus qu'on dirait. */
  invite: FamilyErrorCode | null;
  addGuest: FamilyErrorCode | null;
  /** L'obstacle à dire sous la famille (hors encarts), pour les gestes montrés. */
  blocked: FamilyErrorCode | null;
  showPending: boolean;
  showLeave: boolean;
  showMyPin: boolean;
  showDissolve: boolean;
}

export function familyScreenModel(overview: FamilyOverviewDto): FamilyScreenModel {
  const { account, switches, family } = overview;
  const personal = account.personalSession;
  const role = family?.role ?? null;
  const notices: FamilyNoticeKey[] = [];
  if (!personal) notices.push("notice.personalOnly");
  else if (!switches.families) notices.push("notice.disabled");
  else if (!switches.guests) notices.push("notice.guestsDisabled");

  const actions = familyActions(overview);
  const growth = familyGrowth(overview);
  const showInvite = personal && growth.invite;
  // Un membre sans le droit ne voit pas le bouton : la page lui dit pourquoi.
  const showAddGuest = personal && growth.addGuest;
  // Un membre sans le droit du propriétaire apprend pourquoi (une règle de SA famille, pas de
  // l'administration) ; sinon, l'obstacle d'un geste montré seulement.
  const memberWithoutRight = role === "member" && actions.addGuest === "family.guest_right_required";
  const obstacle = memberWithoutRight
    ? actions.addGuest
    : (showInvite ? actions.invite : null) ?? (showAddGuest ? actions.addGuest : null);

  return {
    notices,
    personal,
    role,
    showIncoming: personal && family === null && answerableInvitations(overview).length > 0,
    showInvite,
    showAddGuest,
    showFamily: family !== null || showInvite || showAddGuest,
    invite: actions.invite,
    addGuest: actions.addGuest,
    blocked: personal && obstacle && !NOTICED.has(obstacle) ? obstacle : null,
    showPending: role === "owner" && (family?.pendingInvitations.length ?? 0) > 0,
    showLeave: personal && role === "member",
    showMyPin: personal && (account.canJoin || family !== null),
    showDissolve: personal && role === "owner",
  };
}
