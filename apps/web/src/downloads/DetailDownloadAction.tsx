/**
 * Bouton de téléchargement des fiches — film, épisode, ET SÉRIE.
 *
 * Rond, aligné sur les CircleAction de DetailActions mais en CSS pur (pas de
 * Framer dans la feature). INVISIBLE sans droit : ni grisé, ni cadenas — non
 * rendu. Si un téléchargement existe déjà (même droit retiré ensuite), le
 * bouton devient un raccourci vers l'écran Téléchargements.
 *
 * Sur une SÉRIE, il n'était pas rendu du tout : il n'y avait aucun moyen de
 * prendre une série entière depuis sa fiche, alors que le téléphone le propose.
 * Les épisodes ne sont demandés qu'à l'appui — une requête, tous les épisodes
 * avec leurs pistes — et le dialogue s'ouvre dès qu'ils arrivent, sur « toute
 * la série », avec ses cases par saison.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSeriesEpisodes } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { supportsDownloads } from "../desktop/bridge";
import { DownloadDialog } from "./DownloadDialog";
import { useDownloadsList, useDownloadsVisibility, useItemDownloadState } from "./useDownloadState";

const ACTIVE_STATUSES = new Set(["queued", "downloading", "paused", "error"]);

export function DetailDownloadAction({ item }: { item: MediaItem }) {
  const { t } = useTranslation("downloads");
  const navigate = useNavigate();
  const { canDownload } = useDownloadsVisibility();
  const state = useItemDownloadState(supportsDownloads() ? item.Id : undefined);
  const entries = useDownloadsList();
  const [open, setOpen] = useState(false);
  // Une série : les épisodes n'arrivent qu'à l'appui.
  const isSeries = item.Type === "Series";
  const [wanted, setWanted] = useState(false);
  const { data: episodes, isError } = useSeriesEpisodes(item.Id, { enabled: wanted && isSeries });
  const [seriesItems, setSeriesItems] = useState<MediaItem[] | null>(null);

  useEffect(() => {
    if (!wanted) return;
    if (isError) {
      setWanted(false);
      return;
    }
    if (episodes === undefined) return;
    setWanted(false);
    setSeriesItems(episodes);
  }, [wanted, episodes, isError]);

  if (!supportsDownloads()) return null;
  if (item.Type !== "Movie" && item.Type !== "Episode" && !isSeries) return null;

  // Une série est « en cours » dès qu'un de ses épisodes l'est.
  const seriesActive = isSeries && entries.some((entry) => entry.seriesId === item.Id && ACTIVE_STATUSES.has(entry.status));
  const isActive = seriesActive || (state !== null && ACTIVE_STATUSES.has(state.status));
  const isComplete = !isSeries && state?.status === "complete";
  // Sans droit ET sans téléchargement existant : AUCUN rendu.
  if (!canDownload && !isActive && !isComplete) return null;

  const label = isComplete
    ? t("downloadedBadge")
    : isActive
      ? t("statusDownloading")
      : isSeries
        ? t("seriesDownload")
        : t("download");

  const handleClick = () => {
    if (isActive || isComplete) {
      navigate("/downloads");
      return;
    }
    if (isSeries) {
      setWanted(true);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={wanted}
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
      {seriesItems !== null && (
        <DownloadDialog items={seriesItems} mode="series" onClose={() => setSeriesItems(null)} />
      )}
    </>
  );
}

/**
 * ⚠️ Terminé ne se dessine PAS par une coche dans un cercle : c'est déjà, au
 * caractère près, le tracé de `CheckCircleIcon` — le marqueur « vu » de
 * `DetailActions`. Les deux boutons voisinent dans la même rangée d'actions, et
 * un film téléchargé y paraissait donc marqué comme vu.
 *
 * On garde la métaphore du téléchargement — le plateau du glyphe « à
 * télécharger », inchangé — et l'on remplace la seule flèche par une coche.
 * L'état se lit sans ambiguïté, et les deux glyphes du bouton restent de la même
 * famille.
 */
function DownloadGlyph({ done }: { done: boolean }) {
  if (done) {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 8.75L11 11.75 16.5 5.5" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}
