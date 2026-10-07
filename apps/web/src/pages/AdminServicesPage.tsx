import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { ServerCapabilityGate } from "@tentacle-tv/api-client";
import { getUserInfo } from "../components/userMenu/menuItems";
import { AdminPage } from "../components/admin/kit";
import { ServicesSummary } from "../components/admin/services/ServicesSummary";
import { JellyfinSection } from "../components/admin/services/JellyfinSection";
import { JellyfinCompatSection } from "../components/admin/jellyfin/JellyfinCompatSection";
import { SetupChecklist } from "../components/admin/jellyfin/SetupChecklist";
import { useJellyfinSetup } from "../components/admin/jellyfin/jellyfinAdminApi";
import { DatabaseSection } from "../components/admin/services/DatabaseSection";
import { PublicUrlSection } from "../components/admin/services/PublicUrlSection";
import { DirectStreamingSection } from "../components/admin/services/DirectStreamingSection";
import { AddressesMovedSection } from "../components/admin/services/AddressesMovedSection";
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
import { AdminRemoteAccessView } from "../components/remoteAccess/AdminRemoteAccessView";

/**
 * Page « Services » (route /admin/services, admin seulement) : l'état des
 * connexions du serveur en tête, puis une section par service — Jellyfin et
 * sa compatibilité (`#compat` : installé, dernier publié, fonctionnalité par
 * fonctionnalité), ses réglages conseillés (`#jellyfin-setup`, la liste
 * complète), base, adresse publique et lecture directe (un renvoi vers
 * « Accès à distance » quand le serveur les y règle), détection des
 * passages — et la réinitialisation à part, dans sa zone de danger.
 *
 * Les ancres (`#jellyfin`, `#publicurl`…) mènent à leur section et à son
 * champ : le verrou de jumelage TV et le bandeau de clé Jellyfin y renvoient.
 */
export function AdminServicesPage({ section }: { section?: "remote-access" } = {}) {
  const { isAdmin } = getUserInfo();
  if (!isAdmin) return <Navigate to="/" replace />;
  // « Accès à distance » (/admin/remote-access) vit dans ce module paresseux :
  // la cible webOS remplace `lazyPages.ts` et ne connaît pas d'autre page.
  return section === "remote-access" ? <AdminRemoteAccessView /> : <ServicesContent />;
}

function ServicesContent() {
  const { t } = useTranslation("adminServices");
  const { recheck, pending } = useRecheck();
  // Les sections ont leur hauteur finale quand leurs lectures ont abouti —
  // réussies ou non : c'est alors qu'une ancre peut viser juste.
  const ready = [useServicesStatus(), usePublicUrlConfig(), useDirectStreamingConfig(), useAudioAnalysis(), useJellyfinSetup()]
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
      <JellyfinCompatSection variant="services" />
      <SetupChecklist />
      <DatabaseSection />
      {/* Le lien public et la lecture directe vivent dans « Accès à distance » quand le serveur le sait. */}
      <ServerCapabilityGate
        capability="admin.remoteAccess"
        fallback={
          <>
            <PublicUrlSection />
            <DirectStreamingSection />
          </>
        }
      >
        <AddressesMovedSection />
      </ServerCapabilityGate>
      <SegmentDetectionSection />
      <DangerZoneSection />
    </AdminPage>
  );
}
