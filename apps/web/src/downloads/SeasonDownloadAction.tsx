/**
 * Action « Télécharger la saison » de la barre d'actions de saison
 * (EpisodeList). Desktop uniquement, non rendue sans droit — invisibilité
 * stricte. Ouvre le dialogue en mode saison (lot d'épisodes).
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { isTauriApp } from "../main";
import { DownloadDialog } from "./DownloadDialog";
import { useDownloadsVisibility } from "./useDownloadState";

export function SeasonDownloadAction({ episodes }: { episodes: MediaItem[] }) {
  const { t } = useTranslation("downloads");
  const { canDownload } = useDownloadsVisibility();
  const [open, setOpen] = useState(false);

  if (!isTauriApp || !canDownload || episodes.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-fill-subtle px-3 py-1.5 text-sm font-medium text-content-secondary transition-colors hover:bg-fill-soft hover:text-content-primary"
      >
        {t("seasonDownload")}
      </button>
      {open && <DownloadDialog items={episodes} seasonMode onClose={() => setOpen(false)} />}
    </>
  );
}
