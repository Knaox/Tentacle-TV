import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LoaderCircle } from "lucide-react";
import { useAdminMetadataRegions, useAdminRegionProviders, useUpdateAdminMetadata } from "@tentacle-tv/api-client";
import { cls } from "../../../pages/adminUtils";
import { useToast } from "../../../contexts/ToastContext";
import { AdminNotice, AdminSection } from "../kit";
import { CountryPicker } from "./CountryPicker";
import { RegionPreview } from "./RegionPreview";
import { buildCountryOptions } from "./countryOptions";

interface RegionCardProps {
  /** La région enregistrée. La page remonte la carte quand elle change. */
  saved: string;
  tmdbConfigured: boolean;
}

/**
 * La région des plateformes : un pays choisi dans une liste (drapeau, nom,
 * recherche), ce que TMDB y référence, et l'aperçu de ses plateformes AVANT
 * d'enregistrer — l'admin voit l'effet de son choix, pas un code à deux
 * lettres. Enregistrée seule, avec « Rétablir » tant qu'elle diffère.
 */
export function RegionCard({ saved, tmdbConfigured }: RegionCardProps) {
  const { t, i18n } = useTranslation("adminMetadata");
  const toast = useToast();
  const labelId = useId();
  const [draft, setDraft] = useState(saved);
  const regions = useAdminMetadataRegions({ enabled: true });
  const update = useUpdateAdminMetadata();
  const options = useMemo(
    () => buildCountryOptions(regions.data, i18n.language, saved),
    [regions.data, i18n.language, saved],
  );
  const covered = (regions.data?.length ?? 0) > 0;
  const draftOption = options.find((o) => o.code === draft);
  const providers = draftOption?.providers ?? null;
  const preview = useAdminRegionProviders(covered && providers ? draft : null);
  const dirty = draft !== saved;

  const save = () =>
    update.mutate(
      { watchRegion: draft },
      { onSuccess: () => toast.show("success", t("regionSavedToast", { country: draftOption?.name ?? draft })) },
    );

  return (
    <AdminSection title={t("regionTitle")} description={t("regionDescription")}>
      <div className="space-y-4">
        <div>
          <span id={labelId} className={cls.lbl}>
            {t("regionLabel")}
          </span>
          <CountryPicker
            value={draft}
            options={options}
            labelId={labelId}
            onChange={(code) => {
              setDraft(code);
              update.reset();
            }}
            footnote={covered ? t("regionCoveredOnly") : undefined}
            disabled={update.isPending}
          />
          {covered && providers !== null && providers > 0 && (
            <p className="mt-2 text-xs text-content-tertiary">{t("regionProviders", { count: providers })}</p>
          )}
          {!covered && !tmdbConfigured && (
            <p className="mt-2 text-xs text-content-tertiary">{t("regionCoverageUnknown")}</p>
          )}
        </div>

        {covered && providers === 0 && <AdminNotice tone="warning">{t("regionNotCovered")}</AdminNotice>}
        {preview.data && preview.data.providers.length > 0 && (
          <RegionPreview providers={preview.data.providers} stale={preview.isPlaceholderData} />
        )}
        {update.isError && (
          <AdminNotice tone="error" role="alert">
            {t("saveFailed")}
          </AdminNotice>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={save} disabled={!dirty || update.isPending} className={cls.bp}>
            {update.isPending && <LoaderCircle aria-hidden size={16} className="animate-spin" />}
            {t("save")}
          </button>
          {dirty && (
            <button
              type="button"
              onClick={() => {
                setDraft(saved);
                update.reset();
              }}
              disabled={update.isPending}
              className={cls.bs}
            >
              {t("regionRevert")}
            </button>
          )}
        </div>
      </div>
    </AdminSection>
  );
}
