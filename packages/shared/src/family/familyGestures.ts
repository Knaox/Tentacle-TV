import type { FamilyOverviewDto, IncomingInvitationDto } from "./familyContract";
import { familyActions, sessionManages } from "./familyClient";
import type { FamilyErrorCode } from "./familyProtocol";

/**
 * Ce que l'administration et le rôle PERMETTENT se voit ; ce qu'ils refusent
 * n'existe pas (retours de l'alpha, 21/10) : ni bouton grisé, ni appel à
 * « Créez votre famille », ni entrée de réglages qui ne mène à rien. Seuls les
 * refus PASSAGERS (famille pleine, quota du jour, invitation en cours) gardent
 * un bouton grisé et leur raison. Le serveur refuse de toute façon. Web,
 * bureau, mobile : la même règle. Module pur : `familyGestures.test.ts`.
 */

/** Les refus qui disent que le geste N'EXISTE PAS pour ce compte. */
const ABSENT: ReadonlySet<FamilyErrorCode> = new Set<FamilyErrorCode>([
  "family.disabled",
  "family.guests_disabled",
  "family.create_family_denied",
  "family.create_guests_denied",
  "family.guest_right_required",
  "family.not_owner",
  "family.guest_account",
  "family.review_account",
  "family.personal_session_required",
]);

/** Le geste existe-t-il (permis, ou refusé seulement pour l'instant) ? */
export function familyGestureExists(refusal: FamilyErrorCode | null): boolean {
  return refusal === null || !ABSENT.has(refusal);
}

export interface FamilyGrowth {
  /** « Inviter un compte » : le propriétaire, ou qui fonderait sa famille en invitant. */
  invite: boolean;
  /** « Ajouter un invité » : le propriétaire, qui fonderait sa famille, ou un membre qui en a le droit. */
  addGuest: boolean;
}

/** Les gestes qui font grandir la famille, MONTRÉS à ce compte (grisés si `familyActions` refuse pour l'instant). */
export function familyGrowth(overview: FamilyOverviewDto): FamilyGrowth {
  if (!sessionManages(overview.account)) return { invite: false, addGuest: false };
  const actions = familyActions(overview);
  const member = overview.family?.role === "member";
  return {
    invite: !member && familyGestureExists(actions.invite),
    addGuest: familyGestureExists(actions.addGuest),
  };
}

/** Les invitations reçues auxquelles on peut répondre : aucune tant que l'administration coupe les
 *  familles (l'accepter serait refusé) — un serveur 1.31.1 ne les rend déjà plus. */
export function answerableInvitations(overview: Pick<FamilyOverviewDto, "switches" | "incoming"> | null | undefined): readonly IncomingInvitationDto[] {
  return overview && overview.switches.families ? overview.incoming : NONE;
}

const NONE: readonly IncomingInvitationDto[] = Object.freeze([]);

/**
 * L'entrée « Famille » des réglages mène-t-elle à quelque chose ? Une famille
 * (même coupée par l'administration : on peut encore quitter, retirer,
 * dissoudre), une invitation reçue encore valable, ou une famille que ce compte
 * peut fonder. Sinon, rien à montrer. Vue d'ensemble pas encore lue :
 * `undefined` — l'appelant n'affiche rien tant qu'il ne sait pas.
 */
export function familyEntryShown(overview: FamilyOverviewDto | null | undefined, now: number): boolean | undefined {
  if (overview === undefined) return undefined;
  if (overview === null) return false;
  if (overview.family !== null) return true;
  if (answerableInvitations(overview).some((invitation) => Date.parse(invitation.expiresAt) > now)) return true;
  const growth = familyGrowth(overview);
  return growth.invite || growth.addGuest;
}
