import { memo, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CARD_GLYPH_VIEWBOX, WATCHED_FILLED_PATH, type MediaItem } from "@tentacle-tv/shared";

/** Focus maintenu sur une saison avant de la précharger : balayer la bande ne charge rien. */
const INTENT_MS = 200;

interface SeasonBandTvProps {
  seasons: MediaItem[];
  selectedId: string | undefined;
  /** La saison de l'épisode à reprendre (ou de l'épisode ouvert) : marquée d'un point. */
  markedId?: string;
  label: string;
  onSelect: (seasonId: string) => void;
  /** Focus qui s'attarde sur une saison : de quoi la précharger. */
  onIntent?: (seasonId: string) => void;
}

/**
 * La bande des saisons de la dalle — la grammaire des autres plateformes
 * (verre épais sous un libellé plein, saison affichée en dégradé de marque
 * profond, point pour la saison en cours, coche des cartes pour une saison vue,
 * compteur d'épisodes), dessinée par `styles/detail-tv.css`.
 *
 * La bande est une PISTE — confinement horizontal, défilement suivi — et une
 * ZONE : y entrer transversalement vise l'onglet actif (`aria-selected`), pas
 * la pastille que l'abscisse du point de départ désignait — la saison 4 sous
 * « Infos techniques ».
 *
 * Pas de fondu de bord par masque ici : la pastille focalisée se trouve
 * souvent au bord de la bande, et l'estomper sous l'anneau la rendrait terne.
 */
export const SeasonBandTv = memo(function SeasonBandTv({ seasons, selectedId, markedId, label, onSelect, onIntent }: SeasonBandTvProps) {
  const band = useRef<HTMLDivElement>(null);
  /** La bande ne se cale sur la saison active qu'UNE fois, à l'arrivée. */
  const wedged = useRef(false);
  const intent = useDwell(onIntent);

  // Le calage initial de la bande : la saison active en vue, une seule fois.
  //
  // Une série reprise en saison 5 présélectionne l'onglet 5 — hors de la bande
  // visible sur une longue série. Sans ce défilement, l'entrée de zone visait
  // un onglet que l'écran ne montrait pas. Écriture directe de `scrollLeft`,
  // jamais `scrollIntoView(options)` : Chrome 53 évalue l'objet comme un
  // booléen et saute brutalement. La position se mesure par les rectangles —
  // `offsetLeft` se rapporte au premier ancêtre positionné, pas au scroller.
  useEffect(() => {
    if (wedged.current || !selectedId) return;
    const container = band.current;
    const active = container?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!container || !active) return;
    wedged.current = true;
    const delta = active.getBoundingClientRect().left - container.getBoundingClientRect().left - 24;
    if (delta > 0) container.scrollLeft += delta;
  }, [selectedId, seasons]);

  return (
    <div className="saisons-tv" role="tablist" aria-label={label} data-tv-piste="" data-tv-zone="saisons" ref={band}>
      {seasons.map((season) => (
        <SeasonTabTv
          key={season.Id}
          season={season}
          selected={season.Id === selectedId}
          marked={season.Id === markedId}
          onSelect={onSelect}
          intent={intent}
        />
      ))}
    </div>
  );
});

interface SeasonTabTvProps {
  season: MediaItem;
  selected: boolean;
  marked: boolean;
  onSelect: (seasonId: string) => void;
  intent: { start: (seasonId: string) => void; cancel: () => void };
}

const SeasonTabTv = memo(function SeasonTabTv({ season, selected, marked, onSelect, intent }: SeasonTabTvProps) {
  const { t } = useTranslation("common");
  const count = season.RecursiveItemCount ?? season.ChildCount;
  const watched = !marked && season.UserData?.Played === true && count !== 0;
  const status = marked ? t("seasonTabCurrent") : watched ? t("seasonTabWatched") : null;
  const label = [season.Name, count ? t("seasonTabEpisodes", { count }) : null, status].filter(Boolean).join(", ");

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-label={label}
      onClick={() => onSelect(season.Id)}
      onFocus={selected ? undefined : () => intent.start(season.Id)}
      onBlur={intent.cancel}
      className={`saison-tv ${selected ? "saison-tv-active" : ""}`}
    >
      {marked && <span className="season-tv-dot" aria-hidden />}
      {watched && (
        <svg className="season-tv-watched" viewBox={CARD_GLYPH_VIEWBOX} aria-hidden fill="currentColor">
          <path fillRule="evenodd" clipRule="evenodd" d={WATCHED_FILLED_PATH} />
        </svg>
      )}
      <span>{season.Name}</span>
      {count ? <span className="season-tv-count" aria-hidden>{count}</span> : null}
    </button>
  );
});

/** Un focus qui reste `INTENT_MS` sur une saison vaut intention : la précharger. */
function useDwell(onIntent: ((seasonId: string) => void) | undefined) {
  const latest = useRef(onIntent);
  useEffect(() => {
    latest.current = onIntent;
  }, [onIntent]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return useMemo(
    () => ({
      start: (seasonId: string) => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => latest.current?.(seasonId), INTENT_MS);
      },
      cancel: () => clearTimeout(timer.current),
    }),
    [],
  );
}
