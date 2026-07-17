import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageTransition } from "../components/PageTransition";
import { getUserInfo } from "../components/userMenu/menuItems";
import { PublicUrlSection } from "../components/admin/PublicUrlSection";
import { ServicesSection } from "../components/admin/ServicesSection";
import { DirectStreamingSection } from "./AdminDirectStreaming";
import { PlaybackSection } from "../components/admin/PlaybackSection";

/**
 * Page dédiée « Services » (route /admin/services, admin only). Regroupe les
 * réglages serveur : URL publique, Jellyfin/base de données/reset, lecture
 * directe, et lecture (auto-play). L'ancre #publicurl est ciblée par le lien
 * « Configurer maintenant » du verrou de jumelage TV.
 */
export function AdminServicesPage() {
  const { t } = useTranslation("admin");
  const { isAdmin } = getUserInfo();
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <PageTransition>
      <div className="px-4 pt-6 pb-16 md:px-12">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-white">{t("services")}</h1>
          <div id="publicurl"><PublicUrlSection /></div>
          <ServicesSection />
          <DirectStreamingSection />
          <PlaybackSection />
        </div>
      </div>
    </PageTransition>
  );
}
