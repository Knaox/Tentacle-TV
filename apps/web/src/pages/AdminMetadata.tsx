import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCw } from "lucide-react";
import { useAdminMetadataStatus, useUpdateAdminMetadata } from "@tentacle-tv/api-client";
import { cls } from "./adminUtils";
import { getUserInfo } from "../components/userMenu/menuItems";
import { AdminNotice, AdminPage, AdminSection } from "../components/admin/kit";
import { MetadataSkeleton } from "../components/admin/metadata/MetadataSkeleton";
import { TmdbKeyCard } from "../components/admin/metadata/TmdbKeyCard";

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
          <TmdbKeyCard tmdb={status.data.tmdb} />
          <RegionField saved={status.data.watchRegion || "FR"} />
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

/** Région des plateformes : code pays à deux lettres, enregistré seul. */
function RegionField({ saved }: { saved: string }) {
  const { t } = useTranslation("admin");
  const update = useUpdateAdminMetadata();
  const [region, setRegion] = useState(saved);
  const draft = region.trim().toUpperCase();

  return (
    <AdminSection title={t("metadataRegionTitle")} description={t("metadataRegionDescription")}>
      <label className={cls.lbl} htmlFor="watch-region">{t("metadataRegionLabel")}</label>
      <div className="flex items-center gap-3">
        <input
          id="watch-region"
          type="text"
          maxLength={2}
          value={region}
          onChange={(e) => {
            setRegion(e.target.value.toUpperCase());
            update.reset();
          }}
          className={`${cls.inp} w-24`}
        />
        <button
          type="button"
          onClick={() => update.mutate({ watchRegion: draft })}
          disabled={update.isPending || !/^[A-Z]{2}$/.test(draft) || draft === saved}
          className={cls.bp}
        >
          {t("save")}
        </button>
        {update.isSuccess && <span className="text-xs text-status-success-fg">{t("saved")}</span>}
        {update.isError && <span className="text-xs text-status-error-fg">{t("saveFailed")}</span>}
      </div>
    </AdminSection>
  );
}
