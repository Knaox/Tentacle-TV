/**
 * Entrée « Téléchargements » du TopNav (desktop uniquement) — non rendue sans
 * droit ni contenu (invisibilité stricte). Point lumineux quand un transfert
 * est actif (animation CSS pure).
 *
 * Elle lit l'avancement GLOBAL du lot en cours (`useOfflineQueueProgress`, le
 * même que l'écran de la file) : il est dit dans son libellé et porté par
 * `data-queue-percent`, pour que l'habillage en fasse une jauge.
 */

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useOfflineQueueProgress } from "@tentacle-tv/offline-core/react";
import { supportsDownloads } from "../desktop/bridge";
import { useDownloadsList, useDownloadsVisibility } from "./useDownloadState";

const ACTIVE = new Set(["queued", "downloading"]);

export function DownloadsNavButton() {
  const { t } = useTranslation(["nav", "downloads"]);
  const navigate = useNavigate();
  const { visible } = useDownloadsVisibility();
  const entries = useDownloadsList();
  const lot = useOfflineQueueProgress(entries);

  if (!supportsDownloads() || !visible) return null;
  const hasActive = entries.some((entry) => ACTIVE.has(entry.status));
  const percent = lot === null || lot.ratio === null ? null : Math.floor(lot.ratio * 100);
  const label =
    percent === null ? t("downloads") : t("downloads:overviewNavProgress", { label: t("downloads"), percent });

  return (
    <button
      type="button"
      onClick={() => navigate("/downloads")}
      aria-label={label}
      title={label}
      data-queue-percent={percent ?? undefined}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-content-secondary transition-colors duration-150 hover:bg-fill-soft hover:text-content-primary"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
      {hasActive && (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand animate-pulse-glow" />
      )}
    </button>
  );
}
