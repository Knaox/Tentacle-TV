import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useHeldRecoItems } from "@tentacle-tv/api-client";
import type { RecoPageRow, RecoRowItem } from "@tentacle-tv/api-client";
import { RowHeader } from "../rows/RowHeader";
import { RowScrollControls } from "../rows/RowScrollControls";
import { useRowScroll } from "../rows/useRowScroll";
import { useRowCardWidth } from "../rows/useRowCardWidth";
import { useRowWindow } from "../rows/useRowWindow";
import { rowIntrinsicHeight } from "../rows/rowTrackReserve";
import { useRowTrackReserve } from "../rows/useRowTrackReserve";
import { useRowEntrance } from "../rows/useRowEntrance";
import { rowEntranceId } from "../rows/rowEntranceMemory";
import { useHoverGuard } from "../../hooks/useHoverGuard";
import { useHoverMount } from "../../hooks/useHoverMount";
import { useInViewport } from "../../hooks/useInViewport";
import { RecoCard } from "./RecoCard";

interface RecoRowProps {
  title: string;
  items: RecoRowItem[];
  /** Après le titre, toujours visible (la puce du filtre sur l'accueil). */
  headerTrailing?: ReactNode;
  /** La raison de la rangée (son thème, sa graine) : les cartes ne la répètent pas. */
  reasonRow?: Pick<RecoPageRow, "why" | "seedTitle">;
}

/**
 * Rangée de recommandations — frère assumé de `MediaRow` (le dépôt a déjà deux
 * carrousels distincts), qui réutilise TOUT le moteur de fenêtrage partagé :
 * `rowWindow`/`useRowWindow` (cartes visibles + 3, fenêtre vidée hors écran),
 * `useRowCardWidth` (nombre entier de cartes), `RowHeader`, `RowScrollControls`
 * (montés au survol — backdrop-filter). Les items ne sont pas des MediaItem
 * Jellyfin : dupliquer la coquille (~90 lignes) coûte moins que généraliser un
 * composant chaud de l'accueil.
 *
 * Survolée, la rangée TIENT ses cartes et les fige (`useHeldRecoItems`) : un
 * titre ajouté à Ma liste, aimé, vu ou noté n'en sort qu'une fois le pointeur
 * parti — retirer une carte plus tôt ferait glisser sa voisine sous le
 * curseur. « Ne plus me proposer », lui, part tout de suite.
 */
export function RecoRow({ title, items, headerTrailing, reasonRow }: RecoRowProps) {
  const [rowEl, setRowEl] = useState<HTMLElement | null>(null);
  const rowRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const { scrollRef, canScrollLeft, canScrollRight, scrollByAmount, onScroll } = useRowScroll();
  const cardWidth = useRowCardWidth(scrollRef, "poster");
  const { ref: observeRow, visible: rowOnScreen } = useInViewport<HTMLElement>("400px");
  // L'entrée, une fois (cf. MediaRow, `rowEntrance`).
  // La même rangée sur l'accueil et sur « Pour vous » : entrée une fois pour ce contenu.
  const entranceId = useMemo(() => rowEntranceId(title, items.map((item) => item.key)), [title, items]);
  const holdEntrance = useRowEntrance(scrollRef, visible, entranceId);
  const setRowRoot = useCallback((el: HTMLElement | null) => {
    rowRef.current = el;
    setRowEl(el);
    observeRow(el);
    holdEntrance(el);
  }, [observeRow, holdEntrance]);
  const controls = useHoverMount(200);
  // La page défile sous un curseur immobile : la rangée n'est plus survolée
  // (cf. RecoCard), elle se relâche — ses titres jugés partent.
  useHoverGuard(rowRef, controls.hovered, controls.onMouseLeave);
  const held = useHeldRecoItems(items, controls.hovered);
  // Clé = le titre : un retrait ne remonte pas les cartes qui le suivent. Un
  // doublon (jamais servi, mais pas garanti par le type) n'en fait qu'une.
  const cards = useMemo(() => {
    const seen = new Set<string>();
    return held.filter((item) => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    });
  }, [held]);
  const track = useRowWindow({ scrollRef, count: cards.length, cardWidth, onScreen: rowOnScreen });
  const { range } = track;
  // Hauteur réservée par la piste tant qu'aucune carte n'y est montée (avant
  // l'entrée à l'écran, fenêtre vidée) : la rangée ne change jamais de taille.
  const cardsMounted = visible && range.end >= range.start;
  const cardHeight = useRowTrackReserve({ scrollRef, cardWidth, shape: "poster", kind: "reco", cardsMounted });
  const caleHeight = cardsMounted ? undefined : (cardHeight ?? undefined);

  const handleScroll = useCallback(() => {
    onScroll();
    track.onScroll();
  }, [onScroll, track]);

  useEffect(() => {
    if (!rowEl) return;
    const observer = new IntersectionObserver(
      // Toute la salve, pas la première entrée (cf. useInViewport).
      (entries) => { if (entries.some((e) => e.isIntersecting)) setVisible(true); },
      { threshold: 0.1 }
    );
    observer.observe(rowEl);
    return () => observer.disconnect();
  }, [rowEl]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); scrollByAmount("right"); }
    if (e.key === "ArrowLeft") { e.preventDefault(); scrollByAmount("left"); }
  }, [scrollByAmount]);

  // Rangée vide : rien du tout — jamais de rangée vide ni de message d'erreur
  // sur cette page (mode dégradé silencieux).
  if (!cards.length) return null;

  return (
    <section
      ref={setRowRoot}
      className="render-row group/row relative mb-10"
      tabIndex={0}
      role="region"
      aria-label={title}
      onKeyDown={handleKeyDown}
      onMouseEnter={controls.onMouseEnter}
      onMouseLeave={controls.onMouseLeave}
      style={cardHeight != null ? { containIntrinsicSize: `auto ${rowIntrinsicHeight(cardHeight)}px` } : undefined}
    >
      <RowHeader title={title} trailing={headerTrailing} />

      <div className="relative">
        <RowScrollControls
          canLeft={canScrollLeft}
          canRight={canScrollRight}
          mounted={controls.mounted}
          shown={controls.hovered}
          onScroll={scrollByAmount}
        />

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          // La pièce de la mini-carte d'aperçu : ses voisines s'y écartent
          // (`cards/preview/room`) ; les cales, elles, ne bougent jamais.
          data-preview-room="row"
          className="row-dim row-gutter flex snap-x snap-proximity gap-3 overflow-x-auto overflow-y-visible pb-6 pt-8 scrollbar-hide scroll-pl-[var(--row-gutter-mobile)] md:scroll-pl-[var(--row-gutter-desktop)]"
        >
          {!visible && caleHeight != null && <div aria-hidden data-room-skip style={{ height: caleHeight, flexShrink: 0 }} />}
          {visible && (
            <>
              {range.padStart > 0 && (
                <div aria-hidden data-room-skip style={{ width: range.padStart, height: caleHeight, flexShrink: 0 }} />
              )}
              {cards.slice(range.start, range.end + 1).map((item, offset) => {
                const i = range.start + offset;
                return (
                  <RecoCard
                    key={item.key}
                    item={item}
                    index={i}
                    width={cardWidth}
                    onHoverIndex={track.setHoveredIndex}
                    reasonRow={reasonRow}
                  />
                );
              })}
              {range.padEnd > 0 && (
                <div aria-hidden data-room-skip style={{ width: range.padEnd, height: caleHeight, flexShrink: 0 }} />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
