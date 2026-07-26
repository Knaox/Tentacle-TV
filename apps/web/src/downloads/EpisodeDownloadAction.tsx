/**
 * Bouton de téléchargement compact d'une ligne d'épisode (EpisodeList).
 * NON RENDU sans droit (invisibilité stricte) — sauf si un téléchargement de
 * cet épisode existe déjà (raccourci vers l'écran Téléchargements, y compris
 * après retrait du droit). stopPropagation : le clic de ligne lance la lecture.
 * Une seule requête partagée (useDownloadsList) pour toutes les lignes.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { supportsDownloads } from "../desktop/bridge";
import { DownloadDialog } from "./DownloadDialog";
import { useDownloadsList, useDownloadsVisibility } from "./useDownloadState";

const ACTIVE = new Set(["queued", "downloading", "paused", "error"]);

export function EpisodeDownloadAction({ episode }: { episode: MediaItem }) {
  const { t } = useTranslation("downloads");
  const navigate = useNavigate();
  const { canDownload } = useDownloadsVisibility();
  const entries = useDownloadsList();
  const [open, setOpen] = useState(false);

  if (!supportsDownloads()) return null;
  const entry = entries.find((e) => e.itemId === episode.Id) ?? null;
  const isActive = entry !== null && ACTIVE.has(entry.status);
  const isComplete = entry?.status === "complete";
  if (!canDownload && !isActive && !isComplete) return null;

  const label = isComplete
    ? t("downloadedBadge")
    : isActive
      ? t("statusDownloading")
      : t("episodeDownload");

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isActive || isComplete) {
      navigate("/downloads");
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        title={label}
        className={`relative flex-shrink-0 transition-colors ${
          isComplete
            ? "text-status-success-fg hover:text-content-tertiary"
            : "text-content-disabled hover:text-content-primary"
        }`}
      >
        {isComplete ? (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        )}
        {isActive && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-brand animate-pulse-glow" />
        )}
      </button>
      {open && (
        <span onClick={(e) => e.stopPropagation()}>
          <DownloadDialog items={[episode]} onClose={() => setOpen(false)} />
        </span>
      )}
    </>
  );
}
