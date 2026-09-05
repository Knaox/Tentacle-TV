import { useEffect, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

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
  /** Forward className to the inner panel. */
  className?: string;
}

const PANEL_VARIANTS = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 8,
    transition: { duration: 0.15, ease: [0.4, 0, 1, 1] as const },
  },
};

// Mouvement réduit : un fondu court, sans déplacement ni échelle. Un jeu de
// variantes CONSTANT, comme l'autre — framer compare les objets par identité,
// un objet recréé à chaque rendu relancerait l'animation.
const PANEL_VARIANTS_REDUCED = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.08 } },
};

const FOCUSABLE_SELECTOR =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

/** Les focusables réellement affichés du panneau (un `display: none` n'a aucun rectangle). */
function focusableIn(panel: HTMLElement): HTMLElement[] {
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
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();

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

  // Focus trap — store last focused, autofocus panel, restore on close
  useEffect(() => {
    if (!open) return;
    lastFocusRef.current = document.activeElement as HTMLElement | null;
    const focusFirst = () => {
      const panel = panelRef.current;
      if (!panel) return;
      (focusableIn(panel)[0] ?? panel).focus();
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
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: reduced ? 0.12 : 0.18 } }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0.08 : 0.12 } }}
          onClick={handleBackdrop}
          role="presentation"
          style={{
            // `--glass-backdrop` EST le scrim de modale du design system : il
            // reste sombre dans les deux schémas (standard iOS au-dessus de
            // contenus photo/vidéo), simplement plus léger en clair. Le
            // `rgba(0,0,0,0.65)` en dur qu'il remplace ignorait le thème.
            background: "var(--glass-backdrop)",
            backdropFilter: "blur(var(--blur-modal))",
            WebkitBackdropFilter: "blur(var(--blur-modal))",
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            tabIndex={-1}
            className={`relative w-full overflow-hidden outline-none ${className ?? ""}`}
            style={{
              maxWidth: typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth,
              background: "var(--surface-modal)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-xl)",
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
