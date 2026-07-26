/**
 * Bouton de téléchargement des fiches (film et épisode) — rond, aligné sur
 * les CircleAction de DetailActions mais en CSS pur (pas de Framer dans la
 * feature). INVISIBLE sans droit : ni grisé, ni cadenas — non rendu.
 * Si un téléchargement existe déjà (même droit retiré ensuite), le bouton
 * devient un raccourci vers l'écran Téléchargements.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { supportsDownloads } from "../desktop/bridge";
import { DownloadDialog } from "./DownloadDialog";
import { useDownloadsVisibility, useItemDownloadState } from "./useDownloadState";

const ACTIVE_STATUSES = new Set(["queued", "downloading", "paused", "error"]);

export function DetailDownloadAction({ item }: { item: MediaItem }) {
  const { t } = useTranslation("downloads");
  const navigate = useNavigate();
  const { canDownload } = useDownloadsVisibility();
  const state = useItemDownloadState(supportsDownloads() ? item.Id : undefined);
  const [open, setOpen] = useState(false);

  if (!supportsDownloads()) return null;
  if (item.Type !== "Movie" && item.Type !== "Episode") return null;

  const isActive = state !== null && ACTIVE_STATUSES.has(state.status);
  const isComplete = state?.status === "complete";
  // Sans droit ET sans téléchargement existant : AUCUN rendu.
  if (!canDownload && !isActive && !isComplete) return null;

  const label = isComplete
    ? t("downloadedBadge")
    : isActive
      ? t("statusDownloading")
      : t("download");

  const handleClick = () => {
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
        className={`relative flex h-11 w-11 items-center justify-center rounded-full border transition-all duration-150 hover:scale-105 hover:bg-fill-medium active:scale-95 ${
          isComplete
            ? "border-content-primary bg-fill-medium text-content-primary"
            : "border-line-strong text-content-secondary"
        }`}
      >
        <DownloadGlyph done={isComplete} />
        {isActive && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand animate-pulse-glow" />
        )}
      </button>
      {open && <DownloadDialog items={[item]} onClose={() => setOpen(false)} />}
    </>
  );
}

function DownloadGlyph({ done }: { done: boolean }) {
  if (done) {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}
