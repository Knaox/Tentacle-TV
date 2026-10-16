import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { LayoutChangeEvent, ScrollView, View } from "react-native";
import type { AnimatedRef } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import {
  INITIAL_ROW_HEAD,
  REVEAL_NEAREST_MARGIN,
  nextRowHeadDeadline,
  reduceRowHead,
  trailerPreviewRevealOffset,
  type RowHeadEvent,
  type RowHeadMotion,
} from "@tentacle-tv/tv-core";
import { usePreviewReveal } from "./previewRevealPort";
import { useRowGlide } from "./rowGlide";
import { useRowHeadOptions } from "./rowHeadMode";

/**
 * La PLACE d'une grande carte d'aperçu dans sa rangée (`CardPreviewTile`) :
 *
 * - en largeur, la carte dont l'aperçu démarre passe EN TÊTE : la rangée
 *   défile pour qu'elle prenne la place de la première (tv-core
 *   `trailerPreviewRowHead.ts`, qui décide de tout — où, quand, la place au
 *   bout, le départ du focus). Rien ne bouge avant l'aperçu. Vers la fin de la
 *   rangée, la piste RÉSERVE d'abord la place qu'il faut (un retrait à droite)
 *   et ne défile qu'une fois cette place posée (`onContentSizeChange`) : elle
 *   bornerait sinon le défilement à son contenu d'avant. Le passage en tête
 *   se joue avec la grande carte (`rowGlide`), le retour est ordinaire ;
 * - en hauteur, la page défile si la grande carte dépasse en bas
 *   (`previewRevealPort`, tv-core `trailerPreviewRevealOffset`).
 *
 * L'adaptateur n'a ni seuil ni durée : il date les évènements, applique ce que
 * la règle rend et la réveille à l'échéance qu'elle donne.
 */

/** La largeur et la hauteur de la scène. */
const SCREEN_WIDTH = 1920;
const SCREEN_HEIGHT = 1080;
/** Le retrait du haut de la piste (`MediaRow`, `content.paddingTop`). */
const TRACK_PADDING_TOP = 12;
/** Ce que la légende tient sous la grande carte (titre, sous-titre, indication). */
const CAPTION_ROOM = 96;

export interface RowPreviewRoomInput {
  track: AnimatedRef<ScrollView>;
  /** Le défilement actuel de la piste, relevé sans rendu. */
  scrollX: RefObject<number>;
  cardWidth: number;
  inset: number;
  /** Les cartes montées dans la piste. */
  cardCount: number;
}

export function useRowPreviewRoom({ track, scrollX, cardWidth, inset, cardCount }: RowPreviewRoomInput) {
  const reveal = usePreviewReveal();
  const options = useRowHeadOptions();
  const [reserve, setReserve] = useState(0);
  const latest = useRef({ cardWidth, inset, cardCount, options });
  latest.current = { cardWidth, inset, cardCount, options };
  const head = useRef(INITIAL_ROW_HEAD);
  const pending = useRef<{ x: number; motion: RowHeadMotion } | null>(null);
  // La largeur de la grande carte, vue au dernier aperçu : la place se pose d'avance au focus.
  const tileWidth = useRef<number | undefined>(undefined);
  const wake = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRef = useRef<View>(null);
  const trackTop = useRef(0);

  const glide = useRowGlide(track);
  const move = useCallback(
    (x: number, motion: RowHeadMotion) => {
      if (motion === "withPreview") return glide.glide(scrollX.current ?? 0, x);
      if (motion === "withCollapse") return glide.glideBack(scrollX.current ?? 0, x);
      glide.stop();
      track.current?.scrollTo({ x, y: 0, animated: true });
    },
    [glide, scrollX, track],
  );

  const dispatch = useRef<(event: RowHeadEvent) => void>(() => undefined);
  dispatch.current = (event) => {
    const geometry = latest.current;
    const before = head.current.trailing;
    const step = reduceRowHead(head.current, event, {
      cardCount: geometry.cardCount,
      cardWidth: geometry.cardWidth,
      gap: TV_STAGE.row.gap,
      inset: geometry.inset,
      viewportWidth: SCREEN_WIDTH,
      rightMargin: TV_STAGE.safe.x,
      ...geometry.options,
      scrollX: scrollX.current ?? 0,
    });
    head.current = step.state;
    if (step.state.trailing !== before) setReserve(step.state.trailing);
    if (step.scrollTo !== null) {
      // La place grandit : le défilement attend qu'elle soit posée.
      if (step.state.trailing > before) pending.current = { x: step.scrollTo, motion: step.motion };
      else {
        pending.current = null;
        move(step.scrollTo, step.motion);
      }
    }
    if (wake.current) clearTimeout(wake.current);
    wake.current = null;
    const deadline = nextRowHeadDeadline(step.state);
    if (deadline !== null) {
      wake.current = setTimeout(() => dispatch.current({ type: "tick", at: Date.now() }), Math.max(0, deadline - Date.now()));
    }
  };
  useEffect(() => () => {
    if (wake.current) clearTimeout(wake.current);
  }, []);

  /** Le focus d'une carte de la rangée : un pas du focus rend la piste à la plateforme. */
  const onCardFocus = useCallback(
    (index: number, focused: boolean) => {
      glide.stop();
      pending.current = null;
      const at = Date.now();
      dispatch.current(focused ? { type: "focus", index, at, tileWidth: tileWidth.current } : { type: "blur", index, at });
    },
    [glide],
  );

  /** La rangée est remise au début, sans animation (`rowRewind`) : la place posée s'en va. */
  const onRewind = useCallback(() => {
    glide.stop();
    pending.current = null;
    dispatch.current({ type: "reset" });
  }, [glide]);

  const onPreviewExpand = useCallback(
    (index: number, width: number, tileHeight: number) => {
      tileWidth.current = width;
      dispatch.current({ type: "expand", index, tileWidth: width, at: Date.now() });
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
    [reveal],
  );

  /** La grande carte se replie : la règle dit si la rangée recule avec elle (pas de vide). */
  const onPreviewCollapse = useCallback((index: number) => {
    const width = tileWidth.current;
    if (width === undefined) return;
    dispatch.current({ type: "collapse", index, tileWidth: width, at: Date.now() });
  }, []);

  const onContentSizeChange = useCallback(() => {
    const target = pending.current;
    if (target === null) return;
    pending.current = null;
    move(target.x, target.motion);
  }, [move]);

  const onTrackLayout = useCallback((event: LayoutChangeEvent) => {
    trackTop.current = event.nativeEvent.layout.y;
  }, []);

  return { reserve, rowRef, onCardFocus, onRewind, onPreviewExpand, onPreviewCollapse, onContentSizeChange, onTrackLayout };
}
