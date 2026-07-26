/**
 * Entrée « Téléchargements » du TopNav (desktop uniquement) — non rendue sans
 * droit ni contenu (invisibilité stricte). Point lumineux quand un transfert
 * est actif (animation CSS pure).
 */

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supportsDownloads } from "../desktop/bridge";
import { useDownloadsList, useDownloadsVisibility } from "./useDownloadState";

const ACTIVE = new Set(["queued", "downloading"]);

export function DownloadsNavButton() {
  const { t } = useTranslation("nav");
  const navigate = useNavigate();
  const { visible } = useDownloadsVisibility();
  const entries = useDownloadsList();

  if (!supportsDownloads() || !visible) return null;
  const hasActive = entries.some((entry) => ACTIVE.has(entry.status));

  return (
    <button
      type="button"
      onClick={() => navigate("/downloads")}
      aria-label={t("downloads")}
      title={t("downloads")}
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
