import { useTranslation } from "react-i18next";
import { RotateCw } from "lucide-react";
import { useAdminMetadataStatus } from "@tentacle-tv/api-client";
import { cls } from "./adminUtils";
import { getUserInfo } from "../components/userMenu/menuItems";
import { AdminNotice, AdminPage } from "../components/admin/kit";
import { MetadataSkeleton } from "../components/admin/metadata/MetadataSkeleton";
import { TmdbKeyCard } from "../components/admin/metadata/TmdbKeyCard";
import { RecoFanoutStatus } from "../components/admin/metadata/RecoFanoutStatus";
import { RegionCard } from "../components/admin/metadata/RegionCard";

/**
 * Onglet « Métadonnées » : clé TMDB, région des plateformes.
 * Lecture PARTAGÉE avec le bandeau « clé TMDB manquante » (même requête,
 * `live` ici) : squelette pendant la première lecture, erreur avec
 * « Réessayer » si elle échoue — plus de page blanche.
 * Pleine largeur, comme toute page du kit : les deux cartes se rangent côte à
 * côte dès que la place le permet.
 */
export function AdminMetadata() {
  const { t } = useTranslation("adminMetadata");
  const { isAdmin } = getUserInfo();
  const status = useAdminMetadataStatus({ enabled: isAdmin, live: true });

  return (
    <AdminPage title={t("title")} description={t("description")}>
      {status.data ? (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <TmdbKeyCard tmdb={status.data.tmdb}>
            {/* Sans clé, le bilan d'une passe d'avant le retrait mentirait. */}
            {(status.data.tmdb.configured || status.data.fanout?.running) && (
              <RecoFanoutStatus fanout={status.data.fanout} readAt={status.dataUpdatedAt} />
            )}
          </TmdbKeyCard>
          {/* Remontée quand la région enregistrée change : le brouillon repart d'elle. */}
          <RegionCard
            key={status.data.watchRegion || "FR"}
            saved={status.data.watchRegion || "FR"}
            tmdbConfigured={status.data.tmdb.configured}
          />
        </div>
      ) : status.isError ? (
        <AdminNotice
          tone="error"
          role="alert"
          title={t("loadError")}
          action={
            <button type="button" onClick={() => void status.refetch()} disabled={status.isFetching} className={cls.bs}>
              <RotateCw aria-hidden size={16} className={status.isFetching ? "animate-spin" : undefined} />
              {t("retry")}
            </button>
          }
        >
          {t("loadErrorHint")}
        </AdminNotice>
      ) : (
        <MetadataSkeleton />
      )}
    </AdminPage>
  );
}
