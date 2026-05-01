import { useEffect, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

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

/**
 * Canonical modal primitive — replaces 5+ ad-hoc modal implementations.
 * - Centered, scrim 60%, surface-modal bg, blur 20px
 * - Focus trap (auto-focus first interactive child, restore focus on close)
 * - Esc to close (always), click-backdrop to close (configurable)
 * - aria-modal + role="dialog" for screen readers
 * - 240ms scale-in, 150ms scale-out (exit-faster-than-enter rule)
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

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
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
      const focusable = panel.querySelector<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      );
      (focusable ?? panel).focus();
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
          animate={{ opacity: 1, transition: { duration: 0.18 } }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          onClick={handleBackdrop}
          role="presentation"
          style={{
            background: "rgba(0,0,0,0.65)",
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
            }}
            variants={PANEL_VARIANTS}
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
