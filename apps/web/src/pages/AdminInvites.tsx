import { InvitesSection } from "../components/admin/InvitesSection";

/**
 * Section Invitations, désormais une route à part entière.
 *
 * Elle était auparavant rendue en ligne au bas de l'accueil admin, sous cinq
 * cartes-raccourcis : il fallait dérouler tout l'écran pour l'atteindre alors
 * que c'est l'action la plus fréquente de l'administration.
 */
export function AdminInvites() {
  return <InvitesSection id="invites" />;
}
