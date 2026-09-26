import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAdminMetadataStatus, useUpdateAdminMetadata } from "@tentacle-tv/api-client";
import { cls } from "./adminUtils";
import { PageTransition } from "../components/PageTransition";
import { getUserInfo } from "../components/userMenu/menuItems";
import { MetadataSkeleton } from "../components/admin/metadata/MetadataSkeleton";
import { MetadataLoadError } from "../components/admin/metadata/MetadataLoadError";
import { TmdbKeyCard } from "../components/admin/metadata/TmdbKeyCard";

/**
 * Onglet « Métadonnées » : clé TMDB, région des plateformes.
 * Lecture PARTAGÉE avec le bandeau « clé TMDB manquante » (même requête,
 * `live` ici) : squelette pendant la première lecture, erreur avec
 * « Réessayer » si elle échoue — plus de page blanche.
 * Pleine largeur : le rail de l'administration borne déjà la page à gauche ;
 * les deux cartes se rangent côte à côte dès que la place le permet.
 */
export function AdminMetadata() {
  const { t } = useTranslation("adminMetadata");
  const { isAdmin } = getUserInfo();
  const status = useAdminMetadataStatus({ enabled: isAdmin, live: true });

  return (
    <PageTransition>
      <div className="px-4 pt-6 pb-16 md:px-12">
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-content-primary">{t("title")}</h1>
        <p className="mb-6 max-w-3xl text-sm text-content-tertiary">{t("description")}</p>
        {status.data ? (
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <TmdbKeyCard tmdb={status.data.tmdb} />
            <RegionField saved={status.data.watchRegion || "FR"} />
          </div>
        ) : status.isError ? (
          <MetadataLoadError onRetry={() => void status.refetch()} retrying={status.isFetching} />
        ) : (
          <MetadataSkeleton />
        )}
      </div>
    </PageTransition>
  );
}

/** Région des plateformes : code pays à deux lettres, enregistré seul. */
function RegionField({ saved }: { saved: string }) {
  const { t } = useTranslation("admin");
  const update = useUpdateAdminMetadata();
  const [region, setRegion] = useState(saved);
  const draft = region.trim().toUpperCase();

  return (
    <div className="rounded-xl border border-line-subtle bg-fill-faint p-5 sm:p-6">
      <h2 className="mb-1 text-lg font-semibold text-content-primary">{t("metadataRegionTitle")}</h2>
      <p className="mb-4 text-sm text-content-quaternary">{t("metadataRegionDescription")}</p>
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
    </div>
  );
}
