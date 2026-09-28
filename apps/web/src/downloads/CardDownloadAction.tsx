/**
 * Le bouton de téléchargement au survol d'une carte — quatrième pastille du
 * cluster de `CardQuickActions`, dont il reprend les gabarits au pixel.
 *
 * Trois comportements, selon le TYPE de l'item et rien d'autre :
 *   • un FILM     → le dialogue s'ouvre sur ce titre ;
 *   • un ÉPISODE  → idem, et le sélecteur de périmètre s'affiche de lui-même
 *     (cet épisode / la saison / la série) — aucune requête ne part tant qu'on
 *     ne l'élargit pas ;
 *   • une SÉRIE   → ses épisodes sont chargés, puis les cases par saison.
 * Tout le reste (Season, BoxSet, musique) n'est PAS rendu.
 *
 * Le dialogue n'est pas rendu ici : ce bouton est démonté dès que le curseur
 * quitte la carte, il l'emporterait avec lui (cf. `downloadRequest.ts`).
 *
 * Un titre déjà en file ou déjà sur l'appareil rend un bouton en LECTURE SEULE
 * qui mène à l'écran des téléchargements : pause, reprise et suppression sont
 * l'affaire de cet écran, pas d'une vignette qu'on survole en passant.
 *
 * ACCESSIBILITÉ — le contrôle n'existe pas dans le DOM au repos (règle « ce qui
 * n'est pas affiché ne consomme rien »), et les cartes ne sont pas dans l'ordre
 * de tabulation. C'est un raccourci à la SOURIS : il ne retire aucun accès, le
 * clavier garde le chemin complet par la fiche et par la liste d'épisodes.
 */

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { supportsDownloads } from "../desktop/bridge";
import { DownloadGlyph } from "./DownloadGlyph";
import { requestDownload } from "./downloadRequest";
import { useDownloadsVisibility } from "./useDownloadState";
import { useDeviceGroupState, useDeviceItemState } from "./useDeviceState";

/** Mêmes boîtes que `CardQuickActions` : les pastilles s'alignent au pixel. */
const VARIANT_STYLE = {
  compact: { box: "h-7 w-7", icon: "h-3.5 w-3.5", dot: "h-2 w-2" },
  bar: { box: "h-8 w-8", icon: "h-4 w-4", dot: "h-2 w-2" },
  inline: { box: "h-9 w-9", icon: "h-4 w-4", dot: "h-2.5 w-2.5" },
} as const;

interface CardDownloadActionProps {
  item: MediaItem;
  variant?: keyof typeof VARIANT_STYLE;
  /**
   * `tray` : sans pastille propre, dans la capsule du plateau de survol
   * (`CardActionTray`) — ses voisins n'ont ni fond ni liseré.
   */
  tone?: "chip" | "tray";
  /**
   * Le gabarit du plateau (`TRAY_SIZE`), qui remplace celui de la variante :
   * dans la capsule, le bouton se resserre avec ses voisins.
   */
  tray?: { box: string; icon: string };
}

export function CardDownloadAction({ item, variant = "compact", tone = "chip", tray }: CardDownloadActionProps) {
  const { t } = useTranslation("downloads");
  const navigate = useNavigate();
  const { canDownload } = useDownloadsVisibility();
  const isSeries = item.Type === "Series";
  // UNE requête pour toutes les cartes (la liste partagée), lue par un index
  // construit une fois : surtout pas `useItemDownloadState`, dont la clé porte
  // l'itemId — quatre-vingts affiches, quatre-vingts requêtes. Un film ou un
  // épisode se retrouvent par leur `itemId`, la copie COMPLÈTE d'abord (un
  // transfert annulé du même titre la masquait) ; une SÉRIE n'a pas d'entrée à
  // elle — ce sont ses épisodes qui portent son `seriesId`.
  const itemState = useDeviceItemState(isSeries ? "" : item.Id);
  const group = useDeviceGroupState(isSeries ? item.Id : "");

  if (!supportsDownloads()) return null;
  if (item.Type !== "Movie" && item.Type !== "Episode" && !isSeries) return null;

  // L'échec compte comme « en route » : son écran le relance, la carte non.
  const isActive = isSeries ? group.active > 0 : itemState === "active" || itemState === "error";
  // Une série n'est JAMAIS « complète » : elle reste ouverte aux épisodes à
  // venir, et le bouton continue d'offrir les saisons qu'on n'a pas — mais il
  // dit, par son glyphe, que des épisodes sont déjà là.
  const isComplete = !isSeries && itemState === "complete";
  const seriesKept = isSeries && group.kept > 0;
  // Sans droit ET sans téléchargement existant : AUCUN rendu. Ni grisé, ni
  // cadenas — c'est la règle de toute la feature.
  if (!canDownload && !isActive && !isComplete && !seriesKept) return null;

  const label = isComplete
    ? t("cardDownloadOnDevice")
    : isActive
      ? t("cardDownloadActive")
      : seriesKept
        ? t("cardDownloadSeriesSome")
        : isSeries
          ? t("seriesDownload")
          : item.Type === "Episode"
            ? t("episodeDownload")
            : t("download");
  // « Sur cette machine » se lit comme au repos : le glyphe et le vert CONSTANT
  // de la pastille (posé sur média, dans les deux thèmes).
  const kept = isComplete || (seriesKept && !isActive);

  const handleClick = (event: React.MouseEvent) => {
    // Sans les deux, la carte navigue sous le bouton.
    event.stopPropagation();
    event.preventDefault();
    if (isActive || isComplete) {
      navigate("/downloads");
      return;
    }
    requestDownload(item);
  };

  const { dot } = VARIANT_STYLE[variant];
  const { box, icon } = tray ?? VARIANT_STYLE[variant];

  // Posé sur l'affiche : verre sombre et blancs CONSTANTS dans les deux thèmes,
  // comme le reste du cluster. Pas de `backdrop-filter` — ce serait une passe de
  // compositing de plus sur le chemin de survol. L'anneau de focus est blanc lui
  // aussi : un jeton thémé disparaîtrait sur une affiche claire.
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      title={label}
      className={`${box} relative flex items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
        tone === "tray"
          ? `transition-transform duration-150 hover:scale-110 hover:bg-white/10 ${kept ? "text-emerald-400" : "text-white/80 hover:text-white"}`
          : `border bg-black/55 transition hover:scale-105 hover:bg-black/70 ${
              kept ? "border-emerald-400 text-emerald-400" : "border-white/40 text-white hover:border-white"
            }`
      }`}
    >
      <DownloadGlyph done={kept} className={icon} strokeWidth={1.8} />
      {isActive && (
        <span className={`${dot} absolute -right-0.5 -top-0.5 rounded-full bg-brand animate-pulse-glow`} />
      )}
    </button>
  );
}
