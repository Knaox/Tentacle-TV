import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AdminPage } from "../components/admin/kit";
import { TicketBoard } from "../components/support/TicketBoard";
import { getUserInfo } from "../components/userMenu/menuItems";

/**
 * Page dédiée « Tickets de support » (route /admin/tickets, admin only) : le
 * même tableau que la page de support, sur TOUS les tickets, avec le
 * déplacement des cartes. Pleine largeur, comme toute l'administration : quatre
 * colonnes ont besoin de place.
 */
export function AdminTicketsPage() {
  const { t } = useTranslation("admin");
  const { isAdmin } = getUserInfo();
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <AdminPage title={t("supportTickets")} description={t("ticketsDescription")}>
      <TicketBoard scope="all" />
    </AdminPage>
  );
}
