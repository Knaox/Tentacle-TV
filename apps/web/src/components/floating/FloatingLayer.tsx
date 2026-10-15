import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { duration, easeIn, easeOut, exitDuration } from "../../theme/motion";
import { useFloatingPlacement, type FloatingAnchor, type FloatingOptions } from "./useFloatingPlacement";

const VARIANTS = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: duration.fast, ease: easeOut } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: exitDuration(duration.fast), ease: easeIn } },
};

interface FloatingLayerProps extends FloatingOptions {
  open: boolean;
  /** Un élément (le bouton qui ouvre) ou un point (clic droit). */
  anchor: FloatingAnchor;
  /** Échap, clic hors du panneau (l'ancre exceptée : elle bascule elle-même). */
  onDismiss: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  role?: string;
  ariaLabel?: string;
  /** Largeur maximale voulue par l'appelant ; la fenêtre peut borner plus bas. */
  maxWidth?: number;
  /** Le panneau lui-même, pour qui doit y lire (focus, défilement). */
  panelRef?: RefObject<HTMLDivElement | null>;
}

/**
 * Le calque de TOUT panneau flottant du web et du bureau : rendu dans
 * `document.body` (aucun parent en `overflow: hidden`, aucun contexte
 * d'empilement de la barre fixe ne le rogne), placé par la règle commune
 * (`floatingPlacement.ts`), borné à la fenêtre — il défile à l'intérieur au
 * besoin. z-[60] : au-dessus de la barre (40), sous les modales (100).
 */
export function FloatingLayer({
  open, anchor, onDismiss, children, className, style, role, ariaLabel, panelRef, maxWidth, ...options
}: FloatingLayerProps) {
  const ownRef = useRef<HTMLDivElement | null>(null);
  const ref = panelRef ?? ownRef;
  const placement = useFloatingPlacement(open, anchor, ref, options);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      dismissRef.current();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (!("x" in anchor) && anchor.current?.contains(target)) return;
      // Une modale ouverte DEPUIS le panneau (confirmation) n'est pas « dehors ».
      if (target instanceof Element && target.closest("[data-floating-keep]")) return;
      dismissRef.current();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, anchor, ref]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role={role}
          aria-label={ariaLabel}
          className={`fixed z-[60] ${className ?? ""}`}
          style={{
            ...style,
            top: placement?.top ?? 0,
            left: placement?.left ?? 0,
            maxHeight: placement?.maxHeight,
            maxWidth: placement ? Math.min(placement.maxWidth, maxWidth ?? Infinity) : maxWidth,
            transformOrigin: placement?.transformOrigin,
            visibility: placement ? undefined : "hidden",
          }}
          variants={VARIANTS}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
