import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useReducedMotion } from "framer-motion";
import { usePreviewEngine, type PreviewEngine } from "./engine";
import {
  OPEN_GATE,
  engineEngaged,
  engineHovered,
  gateAfterClose,
  gateAfterInputs,
  previewClosingFor,
  previewQuietsAfter,
  previewStage,
  quietAfterHide,
  type PreviewCloseCause,
} from "./previewLifecycle";
import { otherPreviewWanting, previewQuiet, setPreviewWanting, usePreviewQuiet } from "./previewQuiet";
import { placePreview, type PreviewPlacement, type PreviewShape } from "./previewPlacement";
import { inDocument } from "./previewFollow";
import { usePreviewScrolling } from "./previewScrolling";
import { navBottom, usePreviewFollow } from "./usePreviewFollow";
import { previewSettleMs } from "./previewMotion";
import { usePreviewListeners } from "./usePreviewListeners";
import { useKeyboardInCard } from "./useKeyboardInCard";
import { usePreviewRoom } from "./room/usePreviewRoom";
import type { CardPreviewSession } from "./useCardPreview";

/** Ce que la mini-carte rend — `null` tant que rien n'est monté. */
export interface CardPreviewView {
  placement: PreviewPlacement;
  shown: boolean;
  /** Posée : l'agrandissement est fini, la vidéo peut jouer. */
  settled: boolean;
  engine: PreviewEngine;
  portalRef: RefObject<HTMLDivElement | null>;
  close: (cause: PreviewCloseCause) => void;
  /** Le focus est-il dans la mini-carte (pour le rendre à la carte en partant) ? */
  focusInsideRef: RefObject<boolean>;
}

/** La place, mesurée dans la fenêtre, posée dans le DOCUMENT : la mini-carte défile avec la page. */
function measure(anchor: HTMLElement | null, shape: PreviewShape): PreviewPlacement | null {
  if (!anchor) return null;
  const rect = anchor.getBoundingClientRect();
  const placed = placePreview(
    { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    shape,
    { width: window.innerWidth, height: window.innerHeight, safeTop: navBottom() },
  );
  return placed && inDocument(placed, { x: window.scrollX, y: window.scrollY });
}

/** Même place ET même départ (au pixel) : la carte n'a pas bougé depuis le préchargement. */
function samePlace(a: PreviewPlacement, b: PreviewPlacement): boolean {
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height
    && Math.round(a.from.x) === Math.round(b.from.x) && Math.round(a.from.y) === Math.round(b.from.y)
    && Math.abs(a.from.scale - b.from.scale) < 0.005;
}

/**
 * La session d'aperçu d'une carte SURVOLÉE : le moteur (délais, requête,
 * préchargement caché), la porte (fermetures), la place de la mini-carte, et
 * sa révélation en deux temps — placée cachée d'abord, montrée à la commande
 * suivante, pour que la transition ait un point de départ. Elle dit à sa
 * carte quand la mini-carte est vue (`setShown`), avant la peinture.
 */
export function usePreviewSession({ subject, hovered, shape, disabled, anchorRef, portalRef, setShown }: CardPreviewSession): CardPreviewView | null {
  const reduced = useReducedMotion() === true;
  const focusInsideRef = useRef(false);

  const [gate, setGate] = useState(OPEN_GATE);
  const keyboardInCard = useKeyboardInCard(anchorRef, hovered);
  // Le silence après une mini-carte fermée : un survol sans vrai mouvement ne
  // commence pas d'aperçu ; un aperçu déjà demandé n'est pas interrompu.
  const quiet = usePreviewQuiet();
  // Pendant un défilement, aucune intention ; seule une mini-carte déjà ouverte reste.
  const scrolling = usePreviewScrolling();
  const [revealed, setRevealed] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const nextEngaged = engineEngaged({
    wanted: engineHovered({ hovered, hasSubject: subject !== null, disabled, gate, keyboardInCard }),
    engaged,
    quiet,
    scrolling,
    open: revealed,
  });
  if (nextEngaged !== engaged) setEngaged(nextEngaged);
  const engine = usePreviewEngine(subject, nextEngaged);
  const holder = useRef({}).current;
  useEffect(() => {
    setPreviewWanting(holder, nextEngaged);
    return () => setPreviewWanting(holder, false);
  }, [holder, nextEngaged]);
  // La porte suit la carte et le moteur (ajustement au rendu, sans effet).
  const nextGate = gateAfterInputs(gate, { hovered, engineMounted: engine.mount });
  if (nextGate !== gate) setGate(nextGate);

  const [placement, setPlacement] = useState<PreviewPlacement | null>(null);
  // Replacée pour CETTE révélation : on ne remesure pas deux fois (une carte
  // encore en mouvement ne doit pas faire boucler la mesure).
  const replacedRef = useRef(false);
  const live = engine.mount && !gate.cut;
  const wanted = live && engine.visible && !gate.dismissed;

  useLayoutEffect(() => {
    if (!live) {
      setPlacement(null);
      setRevealed(false);
      return;
    }
    if (!wanted) {
      replacedRef.current = false;
      setRevealed(false);
      // Préchargement : placée une fois, cachée. Sortie : elle garde sa place.
      if (!placement) setPlacement(measure(anchorRef.current, shape));
      return;
    }
    if (revealed) return;
    if (!replacedRef.current) {
      // La carte a pu bouger depuis le préchargement (le lift du survol).
      const next = measure(anchorRef.current, shape);
      replacedRef.current = true;
      if (next && (!placement || !samePlace(placement, next))) {
        setPlacement(next);
        return;
      }
    }
    if (!placement) return;
    // Le style de l'état caché est calculé AVANT la bascule : la transition
    // part de la carte, jamais d'une boîte déjà grande.
    portalRef.current?.getBoundingClientRect();
    setRevealed(true);
  }, [live, wanted, placement, revealed, shape, anchorRef, portalRef]);

  const { mounted, shown } = previewStage({
    engineMounted: engine.mount,
    engineVisible: engine.visible,
    gate,
    placed: placement !== null,
    revealed,
  });

  // La carte s'efface sous la mini-carte dans la MÊME image où celle-ci part.
  useLayoutEffect(() => {
    setShown(shown);
  }, [shown, setShown]);
  // Ses voisines s'écartent dans cette même image, et reviennent avec sa sortie.
  usePreviewRoom({ shown, placement, anchorRef, reduced });

  // Effacée par le moteur sous un pointeur resté là (fin, échec) : silence
  // global jusqu'au prochain vrai mouvement (`previewQuiet.ts`).
  const wasShownRef = useRef(false);
  useLayoutEffect(() => {
    const wasShown = wasShownRef.current;
    wasShownRef.current = shown;
    const othersWanting = otherPreviewWanting(holder);
    if (quietAfterHide({ wasShown, shown, hovered, dismissed: gate.dismissed, othersWanting })) previewQuiet.quiet();
  }, [shown, hovered, gate.dismissed, holder]);
  useLayoutEffect(() => () => setShown(false), [setShown]);

  // Posée : la lecture part. Une fois partie, elle le reste jusqu'au démontage
  // (le moteur fait décroître le son pendant la sortie).
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!mounted) {
      setSettled(false);
      return;
    }
    if (!shown || settled) return;
    const id = setTimeout(() => setSettled(true), previewSettleMs(reduced));
    return () => clearTimeout(id);
  }, [mounted, shown, settled, reduced]);

  const close = useCallback((cause: PreviewCloseCause) => {
    // Rien ne se rouvre sous un pointeur immobile — ni ici, ni chez la voisine.
    if (previewQuietsAfter(cause)) previewQuiet.quiet();
    setGate((current) => gateAfterClose(current, previewClosingFor(cause)));
  }, []);

  usePreviewListeners({ shown, anchorRef, portalRef, focusInsideRef, close });
  // Accrochée à sa carte pendant le défilement, jusqu'au démontage.
  usePreviewFollow({ shown, mounted, placement, anchorRef, portalRef, close });

  return useMemo<CardPreviewView | null>(
    () => (mounted && placement ? { placement, shown, settled, engine, portalRef, close, focusInsideRef } : null),
    [mounted, placement, shown, settled, engine, portalRef, close],
  );
}
