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
import { useDownloadsList, useDownloadsVisibility } from "./useDownloadState";

const ACTIVE_STATUSES = new Set(["queued", "downloading", "paused", "error"]);

/** Mêmes boîtes que `CardQuickActions` : les pastilles s'alignent au pixel. */
const VARIANT_STYLE = {
  compact: { box: "h-7 w-7", icon: "h-3.5 w-3.5", dot: "h-2 w-2" },
  bar: { box: "h-8 w-8", icon: "h-4 w-4", dot: "h-2 w-2" },
  inline: { box: "h-9 w-9", icon: "h-4 w-4", dot: "h-2.5 w-2.5" },
} as const;

interface CardDownloadActionProps {
  item: MediaItem;
  variant?: keyof typeof VARIANT_STYLE;
}

export function CardDownloadAction({ item, variant = "compact" }: CardDownloadActionProps) {
  const { t } = useTranslation("downloads");
  const navigate = useNavigate();
  const { canDownload } = useDownloadsVisibility();
  // UNE requête pour toutes les cartes (clé partagée, staleTime 5 s). Surtout
  // pas `useItemDownloadState`, dont la clé porte l'itemId : sur une grille de
  // quatre-vingts affiches, ce serait quatre-vingts requêtes.
  const entries = useDownloadsList();

  if (!supportsDownloads()) return null;
  const isSeries = item.Type === "Series";
  if (item.Type !== "Movie" && item.Type !== "Episode" && !isSeries) return null;

  // Un film ou un épisode se retrouvent par leur `itemId` ; une SÉRIE n'a pas
  // d'entrée à elle — ce sont ses épisodes qui portent son `seriesId`.
  const entry = isSeries ? null : entries.find((e) => e.itemId === item.Id) ?? null;
  const isActive = isSeries
    ? entries.some((e) => e.seriesId === item.Id && ACTIVE_STATUSES.has(e.status))
    : entry !== null && ACTIVE_STATUSES.has(entry.status);
  // Une série n'est JAMAIS « complète » : elle reste ouverte aux épisodes à
  // venir, et le bouton doit continuer d'offrir les saisons qu'on n'a pas.
  const isComplete = !isSeries && entry?.status === "complete";
  // Sans droit ET sans téléchargement existant : AUCUN rendu. Ni grisé, ni
  // cadenas — c'est la règle de toute la feature.
  if (!canDownload && !isActive && !isComplete) return null;

  const label = isComplete
    ? t("cardDownloadOnDevice")
    : isActive
      ? t("cardDownloadActive")
      : isSeries
        ? t("seriesDownload")
        : item.Type === "Episode"
          ? t("episodeDownload")
          : t("download");

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

  const { box, icon, dot } = VARIANT_STYLE[variant];

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
      className={`${box} relative flex items-center justify-center rounded-full border bg-black/55 transition hover:scale-105 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
        isComplete
          ? "border-emerald-400/80 text-emerald-300"
          : "border-white/40 text-white hover:border-white"
      }`}
    >
      <DownloadGlyph done={isComplete} className={icon} strokeWidth={1.8} />
      {isActive && (
        <span className={`${dot} absolute -right-0.5 -top-0.5 rounded-full bg-brand animate-pulse-glow`} />
      )}
    </button>
  );
}
