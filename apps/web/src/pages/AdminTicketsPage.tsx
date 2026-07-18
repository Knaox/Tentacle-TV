import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AdminTickets } from "./AdminTickets";
import { PageTransition } from "../components/PageTransition";
import { getUserInfo } from "../components/userMenu/menuItems";

/** Page dédiée « Tickets de support » (route /admin/tickets, admin only). */
export function AdminTicketsPage() {
  const { t } = useTranslation("admin");
  const { isAdmin } = getUserInfo();
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <PageTransition>
      <div className="px-4 pt-6 pb-16 md:px-12">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-content-primary">{t("supportTickets")}</h1>
          <AdminTickets />
        </div>
      </div>
    </PageTransition>
  );
}
