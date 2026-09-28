import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { sagaSummary, sagaTitle, type MediaItem, type SagaView } from "@tentacle-tv/shared";
import { RowHeader } from "../../rows/RowHeader";
import { RowScrollControls } from "../../rows/RowScrollControls";
import { useRowCardWidth } from "../../rows/useRowCardWidth";
import { useRowScroll } from "../../rows/useRowScroll";
import { useHoverMount } from "../../../hooks/useHoverMount";
import { fadeIn } from "../../../theme/motion";
import { SagaColumn } from "./SagaColumn";
import { useDetailSaga } from "./useDetailSaga";

/**
 * La saga d'un film, sur sa fiche — comme dans Vigie : le nom de la saga
 * selon TMDB, « 8 films · 6 dans la bibliothèque · 2 vus », puis ses volets
 * dans l'ordre, chacun à son rang, le film ouvert cerclé et le prochain à
 * voir signalé. Les volets absents viennent des plugins qui savent les
 * donner (Vigie) ; sans eux, seule la bibliothèque — et pas de rangée pour
 * un film seul de sa saga.
 *
 * Rien n'est rendu tant que la saga et ses films ne sont pas lus : la
 * rangée n'apparaît jamais à moitié. Elle défile comme les autres rangées
 * (flèches au survol, accroche douce) ; une saga tient en quelques cartes,
 * elle se passe du fenêtrage de `MediaRow`.
 */
export function SagaSection({ item }: { item: MediaItem }) {
  const view = useDetailSaga(item);
  return view === null ? null : <SagaRow view={view} />;
}

/**
 * La rangée elle-même, montée seulement quand la saga est lue : les mesures
 * du défileur (`useRowScroll`, `useRowCardWidth`) s'attachent à son montage,
 * et un défileur né plus tard qu'elles ne serait jamais observé.
 */
function SagaRow({ view }: { view: SagaView }) {
  const { t } = useTranslation("media");
  const { scrollRef, canScrollLeft, canScrollRight, scrollByAmount, onScroll } = useRowScroll();
  const cardWidth = useRowCardWidth(scrollRef, "poster");
  // Les zones de défilement portent un `backdrop-filter` : montées au survol
  // seulement, comme dans `MediaRow`.
  const controls = useHoverMount(200);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); scrollByAmount("right"); }
    if (e.key === "ArrowLeft") { e.preventDefault(); scrollByAmount("left"); }
  }, [scrollByAmount]);

  // Le film ouvert, visible d'emblée — le volet d'avant en contexte. Sans
  // animation : la rangée est encore hors de l'écran quand la fiche s'ouvre.
  const currentKey = view.entries.find((e) => e.cue === "current")?.key ?? null;
  useEffect(() => {
    const scroller = scrollRef.current;
    const current = scroller?.querySelector<HTMLElement>('[aria-current="page"]');
    const first = scroller?.firstElementChild as HTMLElement | null | undefined;
    if (!scroller || !current || !first) return;
    const anchor = (current.previousElementSibling as HTMLElement | null) ?? current;
    scroller.scrollLeft = anchor.offsetLeft - first.offsetLeft;
  }, [currentKey, scrollRef]);

  const title = sagaTitle(t, view);

  return (
    <motion.section
      className="group/row relative"
      aria-label={title}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={controls.onMouseEnter}
      onMouseLeave={controls.onMouseLeave}
      variants={fadeIn}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-50px" }}
    >
      <RowHeader
        title={title}
        trailing={<span className="truncate text-sm text-content-tertiary">{sagaSummary(t, view)}</span>}
      />
      <div className="relative">
        <RowScrollControls
          canLeft={canScrollLeft}
          canRight={canScrollRight}
          mounted={controls.mounted}
          shown={controls.hovered}
          onScroll={scrollByAmount}
        />
        {/* Mêmes marges que `MediaRow` : `pt-8` laisse passer le survol des
            cartes, que `overflow-x: auto` rognerait au bord de la boîte. */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="row-gutter flex snap-x snap-proximity gap-3 overflow-x-auto overflow-y-visible pb-6 pt-8 scrollbar-hide scroll-pl-[var(--row-gutter-mobile)] md:scroll-pl-[var(--row-gutter-desktop)]"
        >
          {view.entries.map((entry, index) => (
            <SagaColumn key={entry.key} entry={entry} index={index} width={cardWidth} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}
