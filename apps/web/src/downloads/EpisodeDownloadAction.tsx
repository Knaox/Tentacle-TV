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
import { DownloadGlyph } from "./DownloadGlyph";
import { useDownloadsVisibility } from "./useDownloadState";
import { useDeviceItemState } from "./useDeviceState";

export function EpisodeDownloadAction({ episode }: { episode: MediaItem }) {
  const { t } = useTranslation("downloads");
  const navigate = useNavigate();
  const { canDownload } = useDownloadsVisibility();
  // La liste partagée, lue par l'index (copie complète d'abord) : une `Map`
  // par version de la liste, pas un `find()` par ligne.
  const state = useDeviceItemState(episode.Id);
  const [open, setOpen] = useState(false);

  if (!supportsDownloads()) return null;
  // L'échec compte comme « en route » : son écran le relance, la ligne non.
  const isActive = state === "active" || state === "error";
  const isComplete = state === "complete";
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
        <DownloadGlyph done={isComplete} strokeWidth={1.8} />
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
