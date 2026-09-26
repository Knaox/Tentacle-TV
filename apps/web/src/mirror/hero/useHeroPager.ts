import { useCallback, useEffect, useRef, useState } from "react";
import { useBillboardRotation } from "../../components/hero/useBillboardRotation";
import { HERO_ROTATE_MS, pageIndex } from "./heroSlides";

/** Silence de défilement après lequel le geste est tenu pour fini. */
const SETTLE_MS = 140;

/**
 * La pagination du bandeau (`HeroBanner` de l'app : FlatList `pagingEnabled`
 * + minuterie de 8 s), sur un défilement horizontal à `scroll-snap`.
 *
 * La minuterie est celle du bureau (`useBillboardRotation`) : elle ne tourne
 * que si `visible` (bandeau à l'écran ET page au premier plan) et jamais sous
 * le doigt. Une diapositive atteinte au geste relance un cycle entier ; la
 * minuterie, elle, fait défiler la piste en douceur — jusqu'à revenir à la
 * première, comme l'app.
 */
export function useHeroPager({ ids, slideW, visible }: { ids: readonly string[]; slideW: number; visible: boolean }) {
  const count = ids.length;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const { index, goTo } = useBillboardRotation({ count, rotateMs: HERO_ROTATE_MS, active: visible && !dragging });
  const safeIndex = Math.min(index, Math.max(0, count - 1));

  // La piste suit l'index : en douceur quand la minuterie avance, d'un coup
  // quand la largeur change (rotation de l'appareil, rail qui apparaît).
  const lastWidth = useRef(slideW);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const resized = lastWidth.current !== slideW;
    lastWidth.current = slideW;
    const target = safeIndex * slideW;
    if (Math.abs(el.scrollLeft - target) < 1) return;
    el.scrollTo({ left: target, behavior: resized ? "auto" : "smooth" });
  }, [safeIndex, slideW]);

  // Un AUTRE jeu de diapositives (filtre changé, reprise renouvelée) repart
  // de la première : sinon image d'une diapositive, texte d'une autre.
  const signature = ids.join("|");
  const signatureRef = useRef(signature);
  useEffect(() => {
    if (signatureRef.current === signature) return;
    signatureRef.current = signature;
    scrollerRef.current?.scrollTo({ left: 0, behavior: "auto" });
    goTo(0);
  }, [signature, goTo]);

  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const indexRef = useRef(safeIndex);
  indexRef.current = safeIndex;
  const settle = useCallback(() => {
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      setDragging(false);
      const el = scrollerRef.current;
      if (!el) return;
      const landed = pageIndex(el.scrollLeft, slideW, count);
      if (landed !== indexRef.current) goTo(landed);
    }, SETTLE_MS);
  }, [slideW, count, goTo]);
  useEffect(() => () => clearTimeout(settleTimer.current), []);

  const onGestureStart = useCallback(() => {
    clearTimeout(settleTimer.current);
    setDragging(true);
  }, []);

  return {
    scrollerRef,
    index: safeIndex,
    handlers: {
      onTouchStart: onGestureStart,
      onTouchEnd: settle,
      onTouchCancel: settle,
      // Pavé tactile ou molette horizontale : même règlement au repos.
      onScroll: settle,
    },
  };
}
