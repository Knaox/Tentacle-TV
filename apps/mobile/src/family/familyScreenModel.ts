import { ownerActions, type FamilyErrorCode, type FamilyOverviewDto } from "@tentacle-tv/shared";

/**
 * La page Famille du mobile — ce qu'elle MONTRE, tiré de la vue d'ensemble
 * rendue par le serveur, dans l'ordre du web : les encarts, ce qui attend une
 * réponse (invitations reçues), ma famille, celles dont je suis membre, mon
 * code PIN, puis la dissolution. Rien n'y est décidé à la place du serveur :
 * un geste masqué ici serait refusé là-bas. Module pur : `familyScreenModel.test.ts`.
 */

export type FamilyNoticeKey = "notice.personalOnly" | "notice.disabled" | "notice.guestsDisabled";

/** Les refus que la page dit déjà dans ses encarts. */
const NOTICED = new Set<FamilyErrorCode>(["family.personal_session_required", "family.disabled", "family.guests_disabled"]);

export interface FamilyScreenModel {
  notices: FamilyNoticeKey[];
  /** Les gestes personnels : répondre, inviter, retirer, quitter, son PIN, dissoudre. */
  personal: boolean;
  showIncoming: boolean;
  showMemberships: boolean;
  showMyPin: boolean;
  showDissolve: boolean;
  /** Inviter un compte / créer un invité : null si permis, sinon le refus qu'on dirait. */
  invite: FamilyErrorCode | null;
  addGuest: FamilyErrorCode | null;
  /** L'obstacle le plus parlant à dire sous « Ma famille » (hors encarts). */
  blocked: FamilyErrorCode | null;
}

export function familyScreenModel(overview: FamilyOverviewDto): FamilyScreenModel {
  const { account, switches } = overview;
  const personal = account.personalSession;
  const notices: FamilyNoticeKey[] = [];
  if (!personal) notices.push("notice.personalOnly");
  else if (!switches.families) notices.push("notice.disabled");
  else if (!switches.guests) notices.push("notice.guestsDisabled");

  const actions = ownerActions(overview);
  const obstacle = actions.invite ?? actions.addGuest;
  return {
    notices,
    personal,
    showIncoming: personal && overview.incoming.length > 0,
    showMemberships: overview.memberships.length > 0,
    showMyPin: personal && (account.canJoin || overview.owned !== null),
    showDissolve: personal && overview.owned !== null,
    invite: actions.invite,
    addGuest: actions.addGuest,
    blocked: obstacle && !NOTICED.has(obstacle) ? obstacle : null,
  };
}
