import { useTranslation } from "react-i18next";
import {
  useAdminTrailers, useServerCapability, useUpdateAdminTrailers, type AdminTrailerSourceStatus,
} from "@tentacle-tv/api-client";
import { SettingToggleRow } from "../../settings/SettingToggleRow";
import { AdminNotice, AdminSection, StatusPill } from "../kit";

/** Le nom d'une langue dans celle de l'interface (« en » → « anglais ») ; le code à défaut. */
function languageName(code: string, uiLanguage: string): string {
  try {
    return new Intl.DisplayNames([uiLanguage], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function SourceRow({ label, status }: { label: string; status: AdminTrailerSourceStatus }) {
  const { t, i18n } = useTranslation("adminMetadata");
  const paused = status.state === "paused";
  const time = paused ? new Date(status.until).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-sm text-content-primary">{label}</span>
      <StatusPill tone={paused ? "warning" : "success"} size="sm">
        {paused ? `${t("trailersSourcePaused", { time })} (${t(`trailersReason_${status.reason}`)})` : t("trailersSourceNormal")}
      </StatusPill>
    </li>
  );
}

/**
 * Métadonnées › « Bandes-annonces » : la case AlloCiné (cochée par défaut),
 * GRISÉE avec son explication quand la langue du serveur ne lui convient pas
 * (AlloCiné n'a que des versions françaises), et l'état des sources — normal,
 * ou en pause jusqu'à une heure et pourquoi. L'état affiché est celui que le
 * serveur relit. Face à un serveur sans `trailers.catalog`, la carte n'existe pas.
 */
export function TrailersCard() {
  const { t, i18n } = useTranslation("adminMetadata");
  const capable = useServerCapability("trailers.catalog");
  const status = useAdminTrailers({ enabled: true });
  const update = useUpdateAdminTrailers();
  if (!capable) return null;

  const data = status.data;
  const unavailableHint = data && !data.allocineAvailable
    ? data.language
      ? t("trailersAllocineUnavailable", { language: languageName(data.language, i18n.language) })
      : t("trailersAllocineUnknownLanguage")
    : null;
  const anyPaused = data ? data.sources.youtube.state === "paused" || data.sources.dailymotion.state === "paused" : false;

  return (
    <AdminSection scope="server" title={t("trailersTitle")} description={t("trailersDescription")}>
      {data ? (
        <div className="space-y-5">
          <SettingToggleRow
            title={t("trailersAllocine")}
            hint={unavailableHint ?? t("trailersAllocineHint")}
            active={data.allocine && data.allocineAvailable}
            disabled={!data.allocineAvailable || update.isPending}
            onChange={(allocine) => update.mutate({ allocine })}
          />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-tertiary">{t("trailersSources")}</p>
            <ul className="space-y-2">
              <SourceRow label="YouTube" status={data.sources.youtube} />
              <SourceRow label="Dailymotion" status={data.sources.dailymotion} />
            </ul>
            {anyPaused && <p className="mt-2 text-xs text-content-tertiary">{t("trailersPausedHint")}</p>}
          </div>
          {update.isError && (
            <AdminNotice tone="error" role="alert">
              {t("saveFailed")}
            </AdminNotice>
          )}
        </div>
      ) : status.isError ? (
        <p className="text-sm text-status-error-fg">{t("trailersLoadError")}</p>
      ) : (
        <div aria-hidden="true" className="h-24 animate-pulse rounded-xl bg-fill-subtle" />
      )}
    </AdminSection>
  );
}
