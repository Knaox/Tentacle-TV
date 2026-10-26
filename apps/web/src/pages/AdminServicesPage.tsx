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
import { ServerUpdateCard } from "../components/admin/serverUpdate/ServerUpdateCard";
import {
  useDirectStreamingConfig,
  usePublicUrlConfig,
  useRecheck,
  useServicesStatus,
} from "../components/admin/services/useServicesData";
import { useHashTarget } from "../components/admin/services/useHashTarget";
import { cls } from "./adminUtils";
import { AdminRemoteAccessView } from "../components/remoteAccess/AdminRemoteAccessView";

/**
 * Deux pages de l'administration dans ce module paresseux (la cible webOS
 * remplace `lazyPages.ts` et n'en connaît pas d'autre) :
 *
 * - « Jellyfin » (route /admin/services, ex-« Services ») : l'état des
 *   connexions en tête, puis la connexion à Jellyfin et sa compatibilité
 *   (`#compat`), ses réglages conseillés (`#jellyfin-setup`), la détection des
 *   passages (`#segments`) — et, face à un serveur d'avant « Accès à
 *   distance », l'adresse publique et la lecture directe ;
 * - « Système » (route /admin/system, `section="system"`) : la mise à jour du
 *   serveur, la base de données (`#database`), la réinitialisation dans sa
 *   zone de danger (`#danger`). Les anciennes ancres de « Services » y mènent
 *   (`adminRedirects.ts`).
 *
 * « Accès à distance » (/admin/remote-access) y vit aussi. Les ancres mènent
 * à leur section et à son champ : le verrou de jumelage TV et le bandeau de
 * clé Jellyfin y renvoient.
 */
export function AdminServicesPage({ section }: { section?: "remote-access" | "system" } = {}) {
  const { isAdmin } = getUserInfo();
  if (!isAdmin) return <Navigate to="/" replace />;
  // « Accès à distance » (/admin/remote-access) vit dans ce module paresseux :
  // la cible webOS remplace `lazyPages.ts` et ne connaît pas d'autre page.
  if (section === "remote-access") return <AdminRemoteAccessView />;
  return section === "system" ? <SystemContent /> : <ServicesContent />;
}

function SystemContent() {
  const { t } = useTranslation("adminServices");
  useHashTarget(!useServicesStatus().isPending);
  return (
    <AdminPage title={t("systemTitle")} description={t("systemDescription")}>
      <ServerUpdateCard />
      <DatabaseSection />
      <DangerZoneSection />
    </AdminPage>
  );
}

function ServicesContent() {
  const { t } = useTranslation("adminServices");
  const { recheck, pending } = useRecheck();
  // Les sections ont leur hauteur finale quand leurs lectures ont abouti —
  // réussies ou non : c'est alors qu'une ancre peut viser juste.
  const ready = [useServicesStatus(), usePublicUrlConfig(), useDirectStreamingConfig(), useJellyfinSetup()]
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
      <SegmentDetectionSection />
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
    </AdminPage>
  );
}
