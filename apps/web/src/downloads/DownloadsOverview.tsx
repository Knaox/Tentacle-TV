/**
 * L'en-tête de l'écran des téléchargements : ce que la machine porte, en un
 * coup d'œil — le titre de la page et son bouton Retour, l'espace du disque
 * (à l'encre : il ne transfère rien), puis les compteurs par état (prêts, en
 * cours, en pause, en échec) et le lien vers le catalogue hors ligne.
 *
 * L'avancement du lot et les gestes de file vivent dans `DownloadsQueuePanel`,
 * la bascule du mode hors ligne dans `OfflineModeToggle` : la page les pose
 * dessous. Plus de halo ni de dégradé décoratif (refonte de nov. 2026).
 */

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { WarningIcon } from "@phosphor-icons/react/dist/csr/Warning";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { ArrowsDownUpIcon } from "@phosphor-icons/react/dist/csr/ArrowsDownUp";
import { PauseCircleIcon } from "@phosphor-icons/react/dist/csr/PauseCircle";
import { HardDriveIcon } from "@phosphor-icons/react/dist/csr/HardDrive";
import type { Icon as IconType } from "@phosphor-icons/react";
import { useOfflineOverview } from "@tentacle-tv/offline-core/react";
import { BackButton } from "../components/ui/BackButton";
import { useOfflineMode } from "../offline/useOfflineMode";
import type { DownloadEntry } from "./api";
import { SpaceMeter } from "./ui/SpaceMeter";
import { useDiskInfo } from "./useDownloadState";

export function DownloadsOverview({ entries }: { entries: readonly DownloadEntry[] }) {
  const { t } = useTranslation(["downloads", "nav"]);
  const overview = useOfflineOverview(entries);
  const { freeBytes, usedBytes } = useDiskInfo();
  // Hors ligne, cet écran est un onglet de la barre (une racine) : pas de Retour.
  const offline = useOfflineMode();

  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div className="flex min-w-0 items-start gap-3.5">
          {!offline && <BackButton className="mt-0.5" />}
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="font-display text-display-3 text-content-primary">{t("nav:downloads")}</h1>
            <p className="text-sm text-content-secondary">{t("downloads:pageSubtitle")}</p>
          </div>
        </div>
        <SpaceMeter usedBytes={usedBytes ?? overview.readyBytes} freeBytes={freeBytes} className="w-full sm:w-[280px]" />
      </div>

      {entries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {overview.ready > 0 && <Stat icon={CheckCircleIcon} tone="chip-success" label={t("downloads:overviewReady", { count: overview.ready })} />}
          {overview.running > 0 && <Stat icon={ArrowsDownUpIcon} tone="chip-accent" label={t("downloads:overviewRunning", { count: overview.running })} />}
          {overview.paused > 0 && <Stat icon={PauseCircleIcon} tone="chip-warning" label={t("downloads:overviewPaused", { count: overview.paused })} />}
          {overview.errors > 0 && <Stat icon={WarningIcon} tone="chip-danger" label={t("downloads:overviewErrors", { count: overview.errors })} />}
          {overview.ready > 0 && (
            <Link to="/on-device" className="btn btn-soft btn-sm lg-content-control ml-auto">
              <HardDriveIcon size={16} aria-hidden />
              {t("downloads:openOfflineCatalog")}
            </Link>
          )}
        </div>
      )}
    </header>
  );
}

function Stat({ icon: Icon, tone, label }: { icon: IconType; tone: string; label: string }) {
  return (
    <span className={`chip ${tone} num`}>
      <Icon size={14} weight="fill" aria-hidden />
      {label}
    </span>
  );
}
