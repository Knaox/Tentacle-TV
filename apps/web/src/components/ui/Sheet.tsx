import { useCallback, useEffect, useRef } from "react";
import { useGlassControl } from "./glass/useGlassControl";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";
import { focusableIn } from "./Modal";
import { duration, easeDrawer, easeOut } from "../../theme/motion";
import { lastInputWasKeyboard } from "../../lib/inputModality";
import { exitOr } from "../floating/floatingMotion";
import { useLiquidGlassMode } from "../../theme/glass";
import { useStableScrollLock } from "../../lib/stableScrollLock";

/**
 * Le tiroir glisse de sa propre taille (`translate` en pourcentage), en `transform` ENTIER — le
 * seul que framer 11 confie au compositeur, et un tiroir s'ouvre pendant que son contenu se
 * monte. Sous « réduire les animations », il ne glisse plus : un fondu. Au clavier, rien.
 */
const drawer = (hidden: string, settled: string): Variants => ({
  hidden: { transform: hidden },
  show: { transform: settled, transition: { duration: duration.sheetIn, ease: easeDrawer } },
  exit: exitOr({ transform: hidden, transition: { duration: duration.sheetOut, ease: easeOut } }),
});
const PANEL_RIGHT = drawer("translateX(100%)", "translateX(0%)");
const PANEL_BOTTOM = drawer("translateY(100%)", "translateY(0%)");
const PANEL_REDUCED: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: duration.fast, ease: easeOut } },
  exit: exitOr({ opacity: 0, transition: { duration: duration.menuOut, ease: easeOut } }),
};
const SCRIM: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: duration.sheetOut, ease: easeOut } },
  exit: exitOr({ opacity: 0, transition: { duration: duration.fast, ease: easeOut } }),
};

const NATIVE_BACKDROP = {
  backdropFilter: "blur(var(--blur-sheet))",
  WebkitBackdropFilter: "blur(var(--blur-sheet))",
} as const;

export type SheetPlacement = "right" | "bottom";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  placement?: SheetPlacement;
  /** Width (right) or max-height (bottom) in px. */
  size?: number;
  /** Lock body scroll while open. Default true. */
  lockScroll?: boolean;
  /** Forward className to the panel. */
  className?: string;
  /** ID du titre du panneau : son nom pour les lecteurs d'écran. */
  labelledBy?: string;
  /**
   * Le focus entre dans le panneau à l'ouverture, y boucle au Tab et revient
   * à l'élément d'origine à la fermeture — comme `Modal`. Sur demande
   * seulement : un formulaire en feuille basse dont le premier champ prendrait
   * le focus ouvrirait le clavier du téléphone sans qu'on l'ait touché.
   */
  trapFocus?: boolean;
}

/**
 * Le focus est-il dans un AUTRE dialogue, ouvert par-dessus ce panneau (une
 * confirmation) ? Il faut alors lui laisser Échap et Tab : les deux écouteurs
 * vivent sur `window`, et celui du panneau, posé le premier, passe avant.
 */
function focusInOtherDialog(panel: HTMLElement): boolean {
  const current = document.activeElement;
  return current instanceof HTMLElement && !panel.contains(current) && current.closest('[role="dialog"]') !== null;
}

/**
 * Canonical slide-out sheet primitive — replaces filter panels and mobile
 * picker overlays. Slides from right (desktop secondary nav, filters)
 * or bottom (mobile pickers).
 */
export function Sheet({
  open,
  onClose,
  children,
  placement = "right",
  size = 360,
  lockScroll = true,
  className,
  labelledBy,
  trapFocus = false,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const native = useLiquidGlassMode() === "native";
  // Verre natif : le ton du dessous (`data-lg-tone`), auquel les textes de la
  // feuille s'adaptent — UN ton pour toute la feuille, jamais de bandes.
  const glass = useGlassControl<HTMLDivElement>({ lens: false, scale: "surface" });
  const { ref: glassRef } = glass;
  const setPanel = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node;
    glassRef(node);
  }, [glassRef]);

  // Esc to close ; Tab boucle dans le panneau quand `trapFocus` est demandé.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (trapFocus && panel && focusInOtherDialog(panel)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (!trapFocus || e.key !== "Tab" || !panel) return;
      const items = focusableIn(panel);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const current = document.activeElement;
      const inside = current instanceof HTMLElement && panel.contains(current);
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey) {
        if (!inside || current === panel || current === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!inside || current === panel || current === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, trapFocus]);

  // Entrée du focus à l'ouverture, retour à l'élément d'origine à la fermeture.
  useEffect(() => {
    if (!open || !trapFocus) return;
    const previous = document.activeElement as HTMLElement | null;
    const id = setTimeout(() => {
      const panel = panelRef.current;
      if (panel) (focusableIn(panel)[0] ?? panel).focus();
    }, 50);
    return () => {
      clearTimeout(id);
      previous?.focus?.();
    };
  }, [open, trapFocus]);

  // La page dessous ne défile plus — sans bouger d'un pixel (`lib/stableScrollLock.ts`).
  useStableScrollLock(open && lockScroll);

  const isRight = placement === "right";
  const reduced = useReducedMotion() === true;
  // Le geste qui ouvre ou ferme, lu au rendu qu'il déclenche : au clavier, rien ne s'anime.
  const keyboard = lastInputWasKeyboard();
  const panelVariants = reduced ? PANEL_REDUCED : isRight ? PANEL_RIGHT : PANEL_BOTTOM;

  const panelStyle = isRight
    ? { width: size, height: "100%", right: 0, top: 0, bottom: 0 }
    : { maxHeight: size, width: "100%", left: 0, right: 0, bottom: 0 };

  return createPortal(
    <AnimatePresence custom={keyboard}>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90]"
          variants={SCRIM}
          custom={keyboard}
          initial={keyboard ? false : "hidden"}
          animate="show"
          exit="exit"
          onClick={onClose}
          role="presentation"
          // Scrim de sheet : reste sombre dans les deux thèmes (standard iOS) — ne pas migrer.
          style={{ background: "rgba(0,0,0,0.55)" }}
        >
          <motion.div
            ref={setPanel}
            {...glass.props}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            className={`lg-sheet absolute outline-none ${className ?? ""}`}
            data-side={isRight ? "right" : "bottom"}
            style={{
              ...panelStyle,
              background: "var(--surface-sheet)",
              borderTopLeftRadius: "var(--radius-3xl)",
              borderTopRightRadius: !isRight ? "var(--radius-3xl)" : 0,
              borderBottomLeftRadius: isRight ? "var(--radius-3xl)" : 0,
              boxShadow: "var(--shadow-sheet)",
              // Le flou ne sert qu'au verre natif : hors de lui la feuille est opaque.
              ...(native ? NATIVE_BACKDROP : null),
              overflowY: "auto",
            }}
            // Le tiroir : 320 ms sur sa courbe à l'entrée, 200 ms à la sortie, par le même chemin.
            variants={panelVariants}
            custom={keyboard}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
