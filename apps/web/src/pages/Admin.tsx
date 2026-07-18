import type { ReactNode } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageTransition } from "../components/PageTransition";
import { InvitesSection } from "../components/admin/InvitesSection";
import { AlphaBadge } from "../components/ui/AlphaBadge";
import { cls } from "./adminUtils";
import { getUserInfo } from "../components/userMenu/menuItems";

/**
 * Orchestrateur Admin — cartes-raccourcis vers les pages dédiées (Plugins,
 * Thème, Utilisateurs, Tickets, Services) + section Invitations. Les réglages
 * serveur (URL publique, Jellyfin/DB, lecture directe, lecture) vivent dans
 * /admin/services ; les appareils jumelés et le code de provisionnement sont
 * désormais dans « Jumeler TV » (admin only). Refus d'accès si pas admin.
 */
export function Admin() {
  const { t } = useTranslation("admin");
  const { t: tTheme } = useTranslation("adminTheme");
  const navigate = useNavigate();
  const { isAdmin } = getUserInfo();

  if (!isAdmin) return <Navigate to="/" replace />;

  const shortcut = (title: string, description: string, button: string, to: string, id?: string, badge?: ReactNode) => (
    <div id={id} className={cls.card}>
      <div className="flex flex-col gap-3 xs:flex-row xs:items-center xs:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-content-primary">{title}{badge}</h2>
          <p className="mt-1 text-sm text-content-quaternary">{description}</p>
        </div>
        <button onClick={() => navigate(to)} className={`${cls.bp} self-start xs:self-auto`} style={cls.bpStyle}>
          {button}
        </button>
      </div>
    </div>
  );

  return (
    <PageTransition>
      <div className="px-4 pt-6 pb-16 md:px-12">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-content-primary">{t("title")}</h1>

          {shortcut(t("pluginsTitle"), t("pluginsDescription"), t("managePlugins"), "/admin/plugins")}
          {/* Gestion du thème : fonctionnalité ALPHA (expérimentale) */}
          {shortcut(tTheme("adminCardTitle"), tTheme("adminCardDescription"), tTheme("adminCardButton"), "/admin/theme", undefined, <AlphaBadge />)}
          {shortcut(t("usersTitle"), t("usersDescription"), t("manageUsers"), "/admin/users", "users")}
          {shortcut(t("supportTickets"), t("supportTicketsDescription"), t("manageTickets"), "/admin/tickets", "tickets")}
          {shortcut(t("services"), t("servicesDescription"), t("manageServices"), "/admin/services", "services")}
          <InvitesSection id="invites" />
        </div>
      </div>
    </PageTransition>
  );
}
