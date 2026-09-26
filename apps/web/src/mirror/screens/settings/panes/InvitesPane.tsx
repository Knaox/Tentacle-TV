import { AdminInvites } from "../../../../pages/AdminInvites";

/**
 * `InvitesPane` de l'app (admin) : créer un lien d'invitation et lister les
 * existants. Le contenu est la page web de l'administration
 * (`pages/AdminInvites`), réutilisée telle quelle : copie ou partage du lien,
 * suppression confirmée. L'ancienne `InvitesSection` a disparu avec la refonte
 * des invitations.
 */
export function InvitesPane() {
  return <AdminInvites />;
}
