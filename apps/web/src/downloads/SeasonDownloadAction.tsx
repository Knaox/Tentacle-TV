/**
 * Action « Télécharger la saison » de la barre d'actions de saison
 * (EpisodeList). Desktop uniquement, non rendue sans droit — invisibilité
 * stricte. Ouvre le dialogue en mode saison (lot d'épisodes).
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import type { MediaItem } from "@tentacle-tv/shared";
import { supportsDownloads } from "../desktop/bridge";
import { DownloadDialog } from "./DownloadDialog";
import { useDownloadsVisibility } from "./useDownloadState";

export function SeasonDownloadAction({ episodes }: { episodes: MediaItem[] }) {
  const { t } = useTranslation("downloads");
  const { canDownload } = useDownloadsVisibility();
  const [open, setOpen] = useState(false);

  if (!supportsDownloads() || !canDownload || episodes.length === 0) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-soft btn-sm lg-content-control">
        <DownloadSimpleIcon size={16} aria-hidden />
        {t("seasonDownload")}
      </button>
      {open && <DownloadDialog items={episodes} mode="season" onClose={() => setOpen(false)} />}
    </>
  );
}
