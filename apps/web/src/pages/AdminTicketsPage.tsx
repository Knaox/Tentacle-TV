import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageTransition } from "../components/PageTransition";
import { TicketBoard } from "../components/support/TicketBoard";
import { getUserInfo } from "../components/userMenu/menuItems";

/**
 * Page dédiée « Tickets de support » (route /admin/tickets, admin only) : le
 * même tableau que la page de support, sur TOUS les tickets, avec le
 * déplacement des cartes. Pleine largeur : quatre colonnes ont besoin de place.
 */
export function AdminTicketsPage() {
  const { t } = useTranslation("admin");
  const { isAdmin } = getUserInfo();
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <PageTransition>
      <div className="px-4 pt-6 pb-16 md:px-12">
        <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-content-primary">{t("supportTickets")}</h1>
        <TicketBoard scope="all" />
      </div>
    </PageTransition>
  );
}
