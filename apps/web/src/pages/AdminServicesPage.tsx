import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { getUserInfo } from "../components/userMenu/menuItems";
import { AdminPage } from "../components/admin/kit";
import { ServicesSummary } from "../components/admin/services/ServicesSummary";
import { JellyfinSection } from "../components/admin/services/JellyfinSection";
import { DatabaseSection } from "../components/admin/services/DatabaseSection";
import { PublicUrlSection } from "../components/admin/services/PublicUrlSection";
import { DirectStreamingSection } from "../components/admin/services/DirectStreamingSection";
import { SegmentDetectionSection } from "../components/admin/services/SegmentDetectionSection";
import { DangerZoneSection } from "../components/admin/services/DangerZoneSection";
import {
  useAudioAnalysis,
  useDirectStreamingConfig,
  usePublicUrlConfig,
  useRecheck,
  useServicesStatus,
} from "../components/admin/services/useServicesData";
import { useHashTarget } from "../components/admin/services/useHashTarget";
import { cls } from "./adminUtils";

/**
 * Page « Services » (route /admin/services, admin seulement) : l'état des
 * connexions du serveur en tête, puis une section par service — Jellyfin,
 * base, adresse publique, lecture directe, détection des passages — et la
 * réinitialisation à part, dans sa zone de danger.
 *
 * Les ancres (`#jellyfin`, `#publicurl`…) mènent à leur section et à son
 * champ : le verrou de jumelage TV et le bandeau de clé Jellyfin y renvoient.
 */
export function AdminServicesPage() {
  const { isAdmin } = getUserInfo();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <ServicesContent />;
}

function ServicesContent() {
  const { t } = useTranslation("adminServices");
  const { recheck, pending } = useRecheck();
  // Les sections ont leur hauteur finale quand leurs lectures ont abouti —
  // réussies ou non : c'est alors qu'une ancre peut viser juste.
  const ready = [useServicesStatus(), usePublicUrlConfig(), useDirectStreamingConfig(), useAudioAnalysis()]
    .every((query) => !query.isPending);
  useHashTarget(ready);

  return (
    <AdminPage
      title={t("title")}
      description={t("description")}
      actions={
        <button type="button" onClick={() => void recheck()} disabled={pending} className={cls.bs}>
          <RefreshCw size={16} aria-hidden="true" className={pending ? "motion-safe:animate-spin" : ""} />
          {pending ? t("checking") : t("recheck")}
        </button>
      }
    >
      <ServicesSummary />
      <JellyfinSection />
      <DatabaseSection />
      <PublicUrlSection />
      <DirectStreamingSection />
      <SegmentDetectionSection />
      <DangerZoneSection />
    </AdminPage>
  );
}
