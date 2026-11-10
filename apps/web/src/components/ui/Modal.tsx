import { useEffect, useRef, useCallback } from "react";
import { useGlassControl } from "./glass/useGlassControl";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { duration, easeDrawer, easeOut } from "../../theme/motion";
import { useLiquidGlassMode } from "../../theme/glass";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Optional max-width. Defaults to ~480px (tailwind max-w-md). */
  maxWidth?: number | string;
  /** Disable click-outside-to-close (still closable via Esc / explicit close). */
  dismissOnBackdrop?: boolean;
  /** Lock body scroll while open. Default true. */
  lockScroll?: boolean;
  /** ARIA label/description IDs. */
  labelledBy?: string;
  describedBy?: string;
  /** Un nom accessible sans titre visible à désigner (`aria-label`). */
  label?: string;
  /** `alertdialog` pour une confirmation destructive. Défaut `dialog`. */
  role?: "dialog" | "alertdialog";
  /** Forward className to the inner panel. */
  className?: string;
  /**
   * Où poser le focus à l'ouverture, à la place du premier élément
   * focalisable — qui est souvent la croix de l'en-tête, jamais un bon
   * premier focus quand le panneau a mieux à offrir.
   */
  initialFocus?: () => HTMLElement | null | undefined;
}

// Une feuille (refonte de nov. 2026) : elle entre en 320 ms sur la courbe de tiroir, depuis 97 %
// — jamais depuis rien —, et sort en 200 ms. L'opacité court plus vite que la forme : le contenu
// se lit avant que la feuille ait fini de se poser. Centrée : son origine reste son centre.
const PANEL_VARIANTS = {
  hidden: { opacity: 0, scale: 0.97, y: 10 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: duration.sheetIn, ease: easeDrawer, opacity: { duration: 0.22, ease: "easeOut" } },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 10,
    transition: { duration: duration.sheetOut, ease: easeOut, opacity: { duration: 0.16, ease: "easeOut" } },
  },
};

const PANEL_VARIANTS_REDUCED = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: duration.fast } },
  exit: { opacity: 0, transition: { duration: duration.menuOut } },
};

const PLAIN_SCRIM = { background: "var(--glass-backdrop)" } as const;
const NATIVE_SCRIM = {
  background: "var(--glass-backdrop)",
  backdropFilter: "blur(var(--blur-modal))",
  WebkitBackdropFilter: "blur(var(--blur-modal))",
} as const;

const FOCUSABLE_SELECTOR =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

/** Les focusables réellement affichés du panneau (un `display: none` n'a aucun rectangle). */
export function focusableIn(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.getClientRects().length > 0,
  );
}

/**
 * Canonical modal primitive — replaces 5+ ad-hoc modal implementations.
 * - Centered, scrim 60% with blur 20px, surface-modal bg (no backdrop-filter
 *   on the panel: measured too costly under animated content, see below)
 * - Focus trap: autofocus first interactive child, Tab/Shift+Tab cycle inside
 *   the panel, restore focus on close
 * - Esc to close (always), click-backdrop to close (configurable)
 * - aria-modal + role="dialog" for screen readers
 * - 240ms scale-in, 150ms scale-out (exit-faster-than-enter rule); a short
 *   opacity-only fade under prefers-reduced-motion
 */
export function Modal({
  open,
  onClose,
  children,
  maxWidth = 480,
  dismissOnBackdrop = true,
  lockScroll = true,
  labelledBy,
  describedBy,
  label,
  role = "dialog",
  className,
  initialFocus,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Verre natif : le ton du dessous (`data-lg-tone`), auquel les textes de la
  // feuille s'adaptent — UN ton pour toute la feuille, jamais de bandes ; pas
  // de lentille (le voile floute déjà, cf. plus bas).
  const glass = useGlassControl<HTMLDivElement>({ lens: false, scale: "surface" });
  const { ref: glassRef } = glass;
  const setPanel = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node;
    glassRef(node);
  }, [glassRef]);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();
  const native = useLiquidGlassMode() === "native";

  // Esc ferme ; Tab boucle dans le panneau. Le piège vit sur `window` : le
  // focus peut s'être échappé (clic sur le scrim, lecteur d'écran), et c'est
  // justement là qu'il faut le ramener. Deux modales ouvertes = deux pièges :
  // acceptable, il n'y a jamais qu'un recouvrement de démarrage à la fois.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
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
  }, [open, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!open || !lockScroll) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, lockScroll]);

  // Le choix du premier focus, relu au moment de le poser (le contenu peut
  // n'être monté qu'après l'ouverture).
  const initialFocusRef = useRef(initialFocus);
  initialFocusRef.current = initialFocus;

  // Focus trap — store last focused, autofocus panel, restore on close
  useEffect(() => {
    if (!open) return;
    lastFocusRef.current = document.activeElement as HTMLElement | null;
    const focusFirst = () => {
      const panel = panelRef.current;
      if (!panel) return;
      (initialFocusRef.current?.() ?? focusableIn(panel)[0] ?? panel).focus();
    };
    const id = setTimeout(focusFirst, 50);
    return () => {
      clearTimeout(id);
      lastFocusRef.current?.focus?.();
    };
  }, [open]);

  const handleBackdrop = useCallback(() => {
    if (dismissOnBackdrop) onClose();
  }, [dismissOnBackdrop, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="lg-scrim fixed inset-0 z-[100] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: reduced ? 0.12 : 0.2 } }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0.08 : 0.16 } }}
          onClick={handleBackdrop}
          role="presentation"
          // Le voile seul : hors du verre natif, plus de flou plein écran derrière une feuille
          // opaque (une passe de composition par image pour un fond qu'on ne regarde pas). Le
          // verre natif garde le sien — sa feuille est translucide et lit ce flou.
          style={native ? NATIVE_SCRIM : PLAIN_SCRIM}
        >
          <motion.div
            ref={setPanel}
            {...glass.props}
            role={role}
            aria-modal="true"
            aria-label={label}
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            tabIndex={-1}
            className={`lg-sheet relative w-full overflow-hidden outline-none ${className ?? ""}`}
            style={{
              maxWidth: typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth,
              background: "var(--surface-modal)",
              borderRadius: "var(--radius-3xl)",
              boxShadow: "var(--shadow-modal)",
              // AUCUN backdrop-filter sur le panneau. Il portait la réfraction
              // Liquid Glass — sous un fond à 0,96 d'alpha, invisible (règle du
              // dépôt : au-delà de ~0,9, rien ne se floute), mais recalculée à
              // CHAQUE image dès que le contenu bouge. Mesuré (Chrome 152,
              // 3808×1971, 240 Hz, écran de nouveautés animé) : 98 i/s avec,
              // p95 à 21 ms ; 219 i/s sans — le flou du scrim seul coûte ~5 %.
              // Le tableau des scores saccadait pour la même raison.
            }}
            variants={reduced ? PANEL_VARIANTS_REDUCED : PANEL_VARIANTS}
            initial="hidden"
            animate="show"
            exit="exit"
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
