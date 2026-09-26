import { InvitesSection } from "../../../../components/admin/InvitesSection";

/**
 * `InvitesPane` de l'app (admin) : créer un code d'invitation et lister les
 * existants. Le contenu est la section web de l'administration
 * (`components/admin/InvitesSection`), réutilisée telle quelle : copie du
 * lien au lieu de la feuille de partage native, suppression en plus.
 */
export function InvitesPane() {
  return <InvitesSection />;
}
