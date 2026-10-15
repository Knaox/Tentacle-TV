import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { LayoutChangeEvent, ScrollView, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { REVEAL_NEAREST_MARGIN, trailerPreviewReserve, trailerPreviewRevealOffset, trailerPreviewScrollTarget } from "@tentacle-tv/tv-core";
import { usePreviewReveal } from "./previewRevealPort";

/**
 * La PLACE d'une grande carte d'aperçu dans sa rangée (`CardPreviewTile`) :
 *
 * - en largeur, la rangée défile pour la montrer entière (tv-core
 *   `trailerPreviewScrollTarget`) — et, vers la fin de la rangée, RÉSERVE
 *   d'abord ce dont la carte va s'élargir (un retrait à droite de la piste) :
 *   la piste bornait sinon le défilement à son contenu d'avant, et la grande
 *   carte de la dernière carte débordait à moitié de l'écran. Le défilement
 *   part une fois la place posée (`onContentSizeChange`) ;
 * - au repli, une rangée défilée dans cette réserve revient au bout de son
 *   contenu, puis la réserve s'en va ;
 * - en hauteur, la page défile si la grande carte dépasse en bas
 *   (`previewRevealPort`, tv-core `trailerPreviewRevealOffset`).
 */

/** La largeur et la hauteur de la scène. */
const SCREEN_WIDTH = 1920;
const SCREEN_HEIGHT = 1080;
/** Le retrait du haut de la piste (`MediaRow`, `content.paddingTop`). */
const TRACK_PADDING_TOP = 12;
/** Ce que la légende tient sous la grande carte (titre, sous-titre, indication). */
const CAPTION_ROOM = 96;
/** La réserve s'en va après le repli (le ressort de retour, `exitMs` compris). */
const RESERVE_RELEASE_MS = 500;

export interface RowPreviewRoomInput {
  track: RefObject<ScrollView | null>;
  /** Le défilement actuel de la piste, relevé sans rendu. */
  scrollX: RefObject<number>;
  cardWidth: number;
  inset: number;
  /** Les cartes montées dans la piste. */
  cardCount: number;
}

export function useRowPreviewRoom({ track, scrollX, cardWidth, inset, cardCount }: RowPreviewRoomInput) {
  const reveal = usePreviewReveal();
  const [reserve, setReserve] = useState(0);
  const reserved = useRef(0);
  reserved.current = reserve;
  const count = useRef(cardCount);
  count.current = cardCount;
  const pending = useRef<number | null>(null);
  const release = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRef = useRef<View>(null);
  const trackTop = useRef(0);
  useEffect(() => () => {
    if (release.current) clearTimeout(release.current);
  }, []);

  const scrollTo = useCallback((x: number) => track.current?.scrollTo({ x, y: 0, animated: true }), [track]);

  const onPreviewExpand = useCallback(
    (index: number, tileWidth: number, tileHeight: number) => {
      if (release.current) clearTimeout(release.current);
      release.current = null;
      const target = trailerPreviewScrollTarget({
        index,
        cardCount: count.current,
        cardWidth,
        gap: TV_STAGE.row.gap,
        inset,
        scrollX: scrollX.current ?? 0,
        tileWidth,
        viewportWidth: SCREEN_WIDTH,
        rightMargin: TV_STAGE.safe.x,
      });
      const room = trailerPreviewReserve({ tileWidth, cardWidth });
      if (target !== null) {
        if (reserved.current >= room) scrollTo(target);
        else {
          pending.current = target;
          setReserve(room);
        }
      }
      if (!reveal) return;
      rowRef.current?.measureInWindow((_x, top) => {
        const offset = trailerPreviewRevealOffset({
          top,
          bottom: top + trackTop.current + TRACK_PADDING_TOP + tileHeight + CAPTION_ROOM,
          viewportHeight: SCREEN_HEIGHT,
          topMargin: REVEAL_NEAREST_MARGIN,
          bottomMargin: REVEAL_NEAREST_MARGIN,
        });
        if (offset !== null) reveal.scrollBy(offset);
      });
    },
    [cardWidth, inset, scrollX, scrollTo, reveal],
  );

  const onPreviewCollapse = useCallback(() => {
    if (reserved.current === 0) return;
    const cards = count.current * cardWidth + Math.max(0, count.current - 1) * TV_STAGE.row.gap;
    const end = Math.max(0, inset + cards + TV_STAGE.safe.x - SCREEN_WIDTH);
    if ((scrollX.current ?? 0) > end + 1) scrollTo(end);
    if (release.current) clearTimeout(release.current);
    release.current = setTimeout(() => {
      release.current = null;
      setReserve(0);
    }, RESERVE_RELEASE_MS);
  }, [cardWidth, inset, scrollX, scrollTo]);

  const onContentSizeChange = useCallback(() => {
    const target = pending.current;
    if (target === null) return;
    pending.current = null;
    scrollTo(target);
  }, [scrollTo]);

  const onTrackLayout = useCallback((event: LayoutChangeEvent) => {
    trackTop.current = event.nativeEvent.layout.y;
  }, []);

  return { reserve, rowRef, onPreviewExpand, onPreviewCollapse, onContentSizeChange, onTrackLayout };
}
