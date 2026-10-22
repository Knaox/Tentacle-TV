import { useCallback, useEffect, useRef, type CSSProperties, type HTMLAttributes, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLiquidGlassMode } from "../../theme/glass";
import { useFloatingPlacement, type FloatingAnchor, type FloatingOptions } from "./useFloatingPlacement";
import { floatingVariants } from "./floatingMotion";
import { useGlassControl } from "../ui/glass/useGlassControl";

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
  /** L'identifiant du titre qui nomme le panneau (à la place d'`ariaLabel`). */
  labelledBy?: string;
  /** -1 : le panneau reçoit le focus à l'ouverture (dialogue). */
  tabIndex?: number;
  /** Autres attributs du panneau (id, aria-describedby…). */
  /** `data-lgc-lens` : la lentille propre du panneau (`useGlassControl`, mode natif). */
  attrs?: Pick<HTMLAttributes<HTMLDivElement>, "id" | "aria-describedby" | "aria-modal"> & { "data-lgc-lens"?: "" };
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
  open, anchor, onDismiss, children, className, style, role, ariaLabel, labelledBy, tabIndex, attrs, panelRef, maxWidth, ...options
}: FloatingLayerProps) {
  const ownRef = useRef<HTMLDivElement | null>(null);
  const ref = panelRef ?? ownRef;
  const placement = useFloatingPlacement(open, anchor, ref, options);
  // Le verre des MENUS (`.lg-menu`, la classe convenue avec lg-chrome), en mode
  // natif : la lentille exacte du panneau et le ton du dessous, auquel ses
  // textes s'adaptent. Hors natif, `useGlassControl` ne fait rien.
  const menuGlass = className?.split(/\s+/).includes("lg-menu") ?? false;
  // UNE plaque : un seul ton pour tout le menu, jamais de bandes (règle de la
  // SURFACE — `lgMenu.css`). Le ton se lit sous le panneau entier.
  const glass = useGlassControl<HTMLDivElement>({ lens: menuGlass ? "regular" : false, tone: menuGlass });
  const variants = floatingVariants(useLiquidGlassMode() === "native", useReducedMotion() ?? false);
  const { ref: glassRef } = glass;
  const setPanel = useCallback((node: HTMLDivElement | null) => {
    (ref as { current: HTMLDivElement | null }).current = node;
    glassRef(node);
  }, [ref, glassRef]);
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
          {...attrs}
          {...glass.props}
          ref={setPanel}
          role={role}
          aria-label={ariaLabel}
          aria-labelledby={labelledBy}
          tabIndex={tabIndex}
          className={`fixed z-[60] ${className ?? ""}`}
          style={{
            ...style,
            ...glass.props.style,
            // Avant la première mesure : hors champ plutôt que caché — un panneau
            // caché refuserait le focus qu'on lui donne au montage.
            top: placement?.top ?? 0,
            left: placement?.left ?? -10_000,
            maxHeight: placement?.maxHeight,
            maxWidth: placement ? Math.min(placement.maxWidth, maxWidth ?? Infinity) : maxWidth,
            transformOrigin: placement?.transformOrigin,
          }}
          variants={variants}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          {glass.layers}
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
