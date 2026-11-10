/**
 * Bouton de téléchargement des fiches — film, épisode, ET SÉRIE.
 *
 * Le bouton d'icône du socle (pression à 97 %, couleur au survol — jamais
 * d'échelle au survol). INVISIBLE sans droit : ni grisé, ni cadenas — non
 * rendu. Si un téléchargement existe déjà (même droit retiré ensuite), le
 * bouton devient un raccourci vers l'écran Téléchargements.
 *
 * Il DIT où en est le titre : au trait tant qu'il n'est pas là, PLEIN et vert
 * une fois sur la machine ; pendant le transfert, un anneau à l'avancement du
 * fichier (`QueueRing`, `transform` seul) — plus de point qui bat.
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
import { DownloadGlyph } from "./DownloadGlyph";
import { useDownloadsList, useDownloadsVisibility, useItemDownloadState } from "./useDownloadState";
import { useFileProgress } from "@tentacle-tv/offline-core/react";
import { GLASS_LENS_PROPS, useLiquidGlassSurface } from "../theme/glass";
import { QueueRing } from "./ui/QueueRing";

const ACTIVE_STATUSES = new Set(["queued", "downloading", "paused", "error"]);

/**
 * `capsule` : posé dans la capsule d'actions de la scène de la fiche — pas de
 * liseré propre, couleurs `on-media` (le décor est dessous dans les deux thèmes).
 */
export function DetailDownloadAction({ item, variant = "circle" }: { item: MediaItem; variant?: "circle" | "capsule" }) {
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

  // L'avancement du fichier en route (magasin de progression, hors TanStack).
  const live = useFileProgress(state?.id ?? -1);
  const complete = !isSeries && state?.status === "complete";
  // Dans la capsule de la fiche : un glyphe, sans fond propre — jamais de verre
  // sur du verre (`lgDetailStage.css` réduit la pastille native à son glyphe).
  // Posé sur le décor : couleurs `on-media`, le vert constant de « gardé ».
  const capsuleGlass = useLiquidGlassSurface({
    material: "bead",
    tone: "dark",
    level: "clear",
    shape: "circle",
    interactive: true,
    className: "relative flex h-11 w-11 items-center justify-center",
    fallbackClassName: `icon-btn hover:bg-white/10 ${complete ? "" : "text-on-media-secondary hover:text-on-media-primary"}`,
    style: complete ? { color: "var(--media-badge-success-fg)" } : undefined,
  });

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

  // Un seul fichier en route : son avancement ; une série : ses épisodes sont
  // plusieurs, l'anneau reste à vide et l'écran des téléchargements dit le lot.
  const expected = live?.expectedSize ?? state?.expectedSize ?? null;
  const ratio = !isSeries && state && expected && expected > 0 ? (live?.bytesDone ?? state.bytesDone) / expected : 0;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={wanted}
        aria-label={label}
        title={label}
        data-state={isComplete ? "kept" : isActive ? "active" : "idle"}
        {...(variant === "capsule" ? { ...GLASS_LENS_PROPS, ...capsuleGlass.props } : {})}
        className={variant === "capsule"
          ? capsuleGlass.props.className
          : `icon-btn btn-soft relative h-11 w-11 ${isComplete ? "text-status-success-fg" : ""}`}
      >
        {variant === "capsule" && capsuleGlass.layers}
        <DownloadGlyph done={isComplete || isActive} />
        {isActive && <QueueRing ratio={ratio} className="inset-[2px]" />}
      </button>
      {open && <DownloadDialog items={[item]} onClose={() => setOpen(false)} />}
      {seriesItems !== null && (
        <DownloadDialog items={seriesItems} mode="series" onClose={() => setSeriesItems(null)} />
      )}
    </>
  );
}
