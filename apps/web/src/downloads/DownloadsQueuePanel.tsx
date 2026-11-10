/**
 * Le LOT en cours, en tête de l'écran des téléchargements : UN pourcentage pour tout ce qui
 * transite, qui ne recule pas quand un épisode se termine (`useOfflineQueueProgress`, la seule
 * source — celle du bouton de la barre du haut).
 *
 * Il dit : ce qui part (« Caminandes · Saison 1 »), où en est le lot (le pourcentage en grand,
 * à chasse fixe), « n sur N titres », le volume, le débit et le temps restant, et porte les
 * gestes de file. Sa barre est la jauge au dégradé — `scaleX`, jamais une largeur — ; grise si
 * tout est en pause, rouge si tout a échoué. Dessous, les lignes des transferts (`children`).
 *
 * Panneau OPAQUE (`.ui-panel`) : aucun flou derrière, il ne se verrait pas.
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useOfflineOverview, useOfflineQueueProgress } from "@tentacle-tv/offline-core/react";
import type { DownloadEntry } from "./api";
import { DownloadsQueueActions } from "./DownloadsQueueActions";
import { formatBytes } from "./presets";
import { queueLotLabel } from "./queueLotLabel";
import { formatRate, formatTimeLeft } from "./transferText";
import { OfflineGauge, type GaugeTone } from "./ui/OfflineGauge";

interface Props {
  entries: readonly DownloadEntry[];
  /** Les lignes des transferts en route. */
  children?: ReactNode;
}

export function DownloadsQueuePanel({ entries, children }: Props) {
  const { t } = useTranslation("downloads");
  const overview = useOfflineOverview(entries);
  const lot = useOfflineQueueProgress(entries);
  const inFlight = overview.running + overview.paused + overview.errors;

  if (inFlight === 0 || lot === null) {
    return (
      <section className="ui-panel lg-panel flex flex-col gap-1 px-5 py-4" aria-label={t("overviewProgressLabel")}>
        <h2 className="text-[15px] font-semibold text-content-primary">{t("queueIdleTitle")}</h2>
        <p className="max-w-[65ch] text-[13px] leading-relaxed text-content-secondary">{t("queueIdleHint")}</p>
      </section>
    );
  }

  // L'état du lot : il court dès qu'un transfert court ; sinon la pause, sinon l'échec.
  const state: "running" | "paused" | "error" = overview.running > 0 ? "running" : overview.paused > 0 ? "paused" : "error";
  const tone: GaugeTone = state === "running" ? "lot" : state;
  const eyebrow = state === "running" ? t("sectionActive") : state === "paused" ? t("statusPaused") : t("overviewErrors", { count: overview.errors });
  const name = queueLotLabel(entries);
  const title =
    name === null
      ? t("overviewProgressLabel")
      : name.kind === "season"
        ? `${name.series} · ${t("seasonLabel", { num: name.season })}`
        : name.kind === "series"
          ? name.series
          : name.kind === "title"
            ? name.title
            : t("lotMixed", { count: name.count });
  const ratio = lot.ratio;
  const details = [
    t("overviewLotCount", { done: lot.done, count: lot.count }),
    lot.bytesTotal > 0 ? t("lotBytes", { done: formatBytes(lot.bytesDone), total: formatBytes(lot.bytesTotal) }) : null,
    state === "running" ? formatRate(t, lot.bytesPerSecond) : null,
    state === "running" ? formatTimeLeft(t, lot.etaSeconds == null ? null : lot.etaSeconds * 1_000) : null,
  ].filter((part): part is string => part !== null);

  return (
    <section className="ui-panel lg-panel overflow-hidden" aria-label={t("overviewProgressLabel")} data-lot-state={state}>
      <div className="flex flex-col gap-3.5 px-5 pb-5 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="ui-eyebrow">{eyebrow}</span>
            <h2 className="truncate font-display text-[18px] font-semibold leading-tight tracking-[-0.015em] text-content-primary">{title}</h2>
          </div>
          <DownloadsQueueActions entries={entries} />
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
          <span className="num font-display text-[44px] font-bold leading-none tracking-[-0.03em] text-content-primary" data-lot-percent={ratio === null ? undefined : Math.floor(ratio * 100)}>
            {ratio === null ? "—" : `${Math.floor(ratio * 100)} %`}
          </span>
          <span className="num text-sm text-content-secondary">{details.join(" · ")}</span>
        </div>
        <OfflineGauge ratio={ratio ?? 0} label={t("overviewProgressLabel")} tone={tone} size="lg" live />
      </div>
      {children}
    </section>
  );
}
