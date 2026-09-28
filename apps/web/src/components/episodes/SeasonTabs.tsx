import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, type KeyboardEvent, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { useHorizontalScroll } from "../../hooks/useHorizontalScroll";
import { useHoverMount } from "../../hooks/useHoverMount";
import { EdgeArrows } from "../scroll/EdgeArrows";
import { edgeFadeMask } from "../scroll/edgeFade";
import { WatchedGlyph } from "../cards/cardGlyphs";

/** Largeur du fondu de bord : une pastille qui s'y trouve n'est pas « visible ». */
const EDGE = 64;
/** Délai d'intention avant de précharger une saison survolée : balayer la bande ne charge rien. */
const INTENT_MS = 120;

export interface SeasonTabsProps {
  seasons: MediaItem[];
  selectedId: string | undefined;
  /** La saison de l'épisode à reprendre (ou de l'épisode ouvert) : marquée d'un point. */
  markedId?: string;
  onSelect: (seasonId: string) => void;
  /** Survol ou focus d'une saison : de quoi la précharger. */
  onIntent?: (seasonId: string) => void;
  /** `sm` : le panneau du lecteur. */
  size?: "md" | "sm";
  className?: string;
}

/** Identifiant DOM d'un onglet — le panneau d'épisodes s'y rattache (`aria-labelledby`). */
export const seasonTabId = (seasonId: string) => `season-tab-${seasonId}`;

/**
 * La bande des saisons : des onglets (`tablist`), une pastille par saison.
 *
 * - Lisible sur n'importe quel fond (cf. `theme/seasonTabs.css`) ; la saison
 *   affichée porte le dégradé de marque ; celle qu'on regarde, un point ;
 *   une saison vue, la coche des cartes ; chacune, son nombre d'épisodes.
 * - La saison affichée est ramenée dans le champ à l'ouverture (la saison 14
 *   d'une série de 22 n'est plus hors écran) et à chaque changement.
 * - Au clavier : Tab entre sur la saison affichée, les flèches passent d'une
 *   saison à l'autre, Entrée l'ouvre (activation manuelle : parcourir la
 *   bande ne charge pas chaque saison traversée, il la précharge).
 * - Bords : fondu par masque ; flèches au survol, du côté qui déborde.
 */
export function SeasonTabs({ seasons, selectedId, markedId, onSelect, onIntent, size = "md", className = "" }: SeasonTabsProps) {
  const { t } = useTranslation("common");
  const { ref, canLeft, canRight, scrollBy } = useHorizontalScroll();
  const arrows = useHoverMount(150);
  useKeepInView(ref, selectedId);
  const intent = useIntent(onIntent);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const strip = ref.current;
    if (!strip) return;
    const tabs = Array.from(strip.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    const next = e.key === "ArrowRight" ? index + 1 : e.key === "ArrowLeft" ? index - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const tab = tabs[Math.max(0, Math.min(tabs.length - 1, next))];
    tab.focus({ preventScroll: true });
    reveal(strip, tab, "smooth");
  }, [ref]);

  const focusableId = selectedId ?? seasons[0]?.Id;
  return (
    <div className={`relative ${className}`} onMouseEnter={arrows.onMouseEnter} onMouseLeave={arrows.onMouseLeave}>
      <div
        ref={ref}
        role="tablist"
        aria-label={t("seasons")}
        data-season-tabs
        onKeyDown={onKeyDown}
        // `py-2` / `-my-2` : la lueur de la pastille active et l'anneau de focus
        // débordent — un défilement horizontal rogne aussi à la verticale.
        className="relative -my-2 flex gap-2 overflow-x-auto py-2 scrollbar-hide"
        style={{ overscrollBehaviorX: "contain", scrollBehavior: "smooth", ...edgeFadeMask(canLeft, canRight, EDGE) }}
      >
        {seasons.map((season) => (
          <SeasonTab
            key={season.Id}
            season={season}
            selected={season.Id === selectedId}
            marked={season.Id === markedId}
            focusable={season.Id === focusableId}
            size={size}
            onSelect={onSelect}
            intent={intent}
          />
        ))}
      </div>
      <EdgeArrows canLeft={canLeft} canRight={canRight} mounted={arrows.mounted} shown={arrows.hovered} onScroll={scrollBy} />
    </div>
  );
}

interface SeasonTabProps {
  season: MediaItem;
  selected: boolean;
  marked: boolean;
  focusable: boolean;
  size: "md" | "sm";
  onSelect: (seasonId: string) => void;
  intent: { start: (seasonId: string) => void; cancel: () => void };
}

const SeasonTab = memo(function SeasonTab({ season, selected, marked, focusable, size, onSelect, intent }: SeasonTabProps) {
  const { t } = useTranslation("common");
  const count = season.RecursiveItemCount ?? season.ChildCount;
  const watched = !marked && season.UserData?.Played === true && count !== 0;
  const status = marked ? t("seasonTabCurrent") : watched ? t("seasonTabWatched") : null;
  const label = [season.Name, count ? t("seasonTabEpisodes", { count }) : null, status].filter(Boolean).join(", ");
  const onIntent = selected ? undefined : () => intent.start(season.Id);

  return (
    <button
      type="button"
      role="tab"
      id={seasonTabId(season.Id)}
      aria-selected={selected}
      aria-label={label}
      tabIndex={focusable ? 0 : -1}
      data-season-id={season.Id}
      data-size={size === "sm" ? "sm" : undefined}
      className="season-tab"
      onClick={() => onSelect(season.Id)}
      onPointerEnter={onIntent}
      onPointerLeave={intent.cancel}
      onFocus={onIntent}
    >
      {marked && <span className="season-tab-dot" aria-hidden />}
      {watched && <WatchedGlyph filled className="season-tab-watched" />}
      <span>{season.Name}</span>
      {count ? <span className="season-tab-count" aria-hidden>{count}</span> : null}
    </button>
  );
});

/**
 * Ramène un onglet dans le champ, au centre, s'il est hors de la partie
 * nette de la bande (fondus exclus). Jamais `scrollIntoView` : il ferait
 * aussi défiler la PAGE jusqu'à la bande.
 */
function reveal(strip: HTMLElement, tab: HTMLElement, behavior: ScrollBehavior) {
  const left = tab.offsetLeft;
  const right = left + tab.offsetWidth;
  if (left >= strip.scrollLeft + EDGE && right <= strip.scrollLeft + strip.clientWidth - EDGE) return;
  strip.scrollTo({ left: Math.max(0, left - (strip.clientWidth - tab.offsetWidth) / 2), behavior });
}

/** La saison affichée, dans le champ : d'un coup à l'ouverture, en glissant ensuite. */
function useKeepInView(ref: RefObject<HTMLDivElement | null>, selectedId: string | undefined) {
  const placed = useRef(false);
  useLayoutEffect(() => {
    const strip = ref.current;
    if (!strip || !selectedId) return;
    const tab = strip.querySelector<HTMLElement>(`[data-season-id="${CSS.escape(selectedId)}"]`);
    if (!tab) return;
    // « instant » et non « auto » : `auto` reprendrait le `scroll-behavior:
    // smooth` de la bande, et l'ouverture glisserait depuis la saison 1.
    reveal(strip, tab, placed.current ? "smooth" : "instant");
    placed.current = true;
  }, [ref, selectedId]);
}

/** Une intention de choisir une saison — survol maintenu ou focus — avant de la précharger. */
function useIntent(onIntent: ((seasonId: string) => void) | undefined) {
  const latest = useRef(onIntent);
  useEffect(() => {
    latest.current = onIntent;
  }, [onIntent]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancel = useCallback(() => clearTimeout(timer.current), []);
  const start = useCallback((seasonId: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => latest.current?.(seasonId), INTENT_MS);
  }, []);
  useEffect(() => cancel, [cancel]);
  // Stable : les pastilles mémoïsées ne se re-rendent pas à chaque rendu de la bande.
  return useMemo(() => ({ start, cancel }), [start, cancel]);
}
