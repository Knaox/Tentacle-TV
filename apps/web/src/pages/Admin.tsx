import { useNavigate, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DirectStreamingSection } from "./AdminDirectStreaming";
import { AdminTickets } from "./AdminTickets";
import { PageTransition } from "../components/PageTransition";
import { AdminHeader } from "../components/admin/AdminHeader";
import { InvitesSection } from "../components/admin/InvitesSection";
import { PlaybackSection } from "../components/admin/PlaybackSection";
import { ServicesSection } from "../components/admin/ServicesSection";
import { PairedDevicesSection } from "../components/admin/PairedDevicesSection";
import { cls } from "./adminUtils";
import { getUserInfo } from "../components/userMenu/menuItems";

/**
 * Orchestrateur Admin — recompose les sections extraites pour respecter la
 * limite 300L/fichier. Refus d'accès si pas admin (redirige vers home).
 *
 * Structure mobile-friendly : barre d'ancres `AdminHeader` au sommet, sections
 * empilées avec id pour navigation rapide.
 */
export function Admin() {
  const { t } = useTranslation("admin");
  const navigate = useNavigate();
  const { isAdmin } = getUserInfo();

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <PageTransition>
      <div className="px-4 pt-6 pb-16 md:px-12">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-white">{t("title")}</h1>
          <AdminHeader />

          {/* Plugins shortcut */}
          <div className={cls.card}>
            <div className="flex flex-col gap-3 xs:flex-row xs:items-center xs:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{t("pluginsTitle")}</h2>
                <p className="mt-1 text-sm text-white/40">{t("pluginsDescription")}</p>
              </div>
              <button
                onClick={() => navigate("/admin/plugins")}
                className={`${cls.bp} self-start xs:self-auto`}
                style={cls.bpStyle}
              >
                {t("managePlugins")}
              </button>
            </div>
          </div>

          <InvitesSection id="invites" />
          <div id="tickets"><AdminTickets /></div>
          <PlaybackSection />
          <DirectStreamingSection />
          <div id="services"><ServicesSection /></div>
          <div id="devices"><PairedDevicesSection /></div>
        </div>
      </div>
    </PageTransition>
  );
}
