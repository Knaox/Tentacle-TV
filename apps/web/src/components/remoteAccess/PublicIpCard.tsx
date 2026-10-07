import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { reachabilityOf, type PublicIpReport, type RemoteAccessState } from "@tentacle-tv/shared";

const TONE = {
  open: "text-status-success-fg",
  closed: "text-status-warning-fg",
  unknown: "text-content-tertiary",
  no_service: "text-content-secondary",
  disabled: "text-content-tertiary",
} as const;

/**
 * L'adresse publique de la box, détectée, et ce que l'on sait de sa
 * joignabilité : le dernier test d'ouverture — ou, tant que le service de
 * test n'est pas en ligne, comment vérifier soi-même, adresse comprise.
 */
export const PublicIpCard = memo(function PublicIpCard({ state, report, loading }: { state: RemoteAccessState; report: PublicIpReport | undefined; loading: boolean }) {
  const { t } = useTranslation("remoteAccess");
  const ip = report?.v4 ?? report?.v6 ?? null;
  const online = report?.checkService === undefined ? undefined : report.checkService === "online";
  const reach = reachabilityOf(state.lastCheck, state.checkServiceUrl !== null, online);
  const tryUrl = state.publicUrl ?? (ip ? `http://${ip.includes(":") ? `[${ip}]` : ip}:${state.hostPort}` : null);
  const reachText =
    reach === "no_service" ? (tryUrl ? t("reach_no_service", { url: tryUrl }) : t("reach_no_service_generic")) : t(`reach_${reach}`);
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-semibold text-content-primary">
        <Globe size={16} aria-hidden="true" className="text-content-tertiary" />
        {t("publicIpTitle")}
      </p>
      {loading ? (
        <p className="text-sm text-content-tertiary" aria-live="polite">{t("publicIpLoading")}</p>
      ) : ip ? (
        <p>
          <span className="break-all font-mono text-lg font-semibold tabular-nums text-content-primary" data-testid="public-ip">{ip}</span>{" "}
          <span className="text-xs text-content-tertiary">{t(report?.source === "check" ? "publicIpFromCheck" : "publicIpDetected")}</span>
        </p>
      ) : (
        <p className="text-sm text-content-secondary">{t(report?.outcome === "disabled" ? "publicIpDisabled" : "publicIpUnavailable")}</p>
      )}
      <p className={`text-sm leading-relaxed ${TONE[reach]}`} aria-live="polite">{reachText}</p>
    </div>
  );
});
