import { useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

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
}: SheetProps) {
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

  const isRight = placement === "right";
  const initialOffset = isRight ? { x: "100%" } : { y: "100%" };
  const settledOffset = isRight ? { x: 0 } : { y: 0 };

  const panelStyle = isRight
    ? { width: size, height: "100%", right: 0, top: 0, bottom: 0 }
    : { maxHeight: size, width: "100%", left: 0, right: 0, bottom: 0 };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.18 } }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          onClick={onClose}
          role="presentation"
          style={{ background: "rgba(0,0,0,0.55)" }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className={`absolute outline-none ${className ?? ""}`}
            style={{
              ...panelStyle,
              background: "var(--surface-sheet)",
              borderLeft: isRight ? "1px solid var(--border-subtle)" : undefined,
              borderTop: !isRight ? "1px solid var(--border-subtle)" : undefined,
              borderTopLeftRadius: isRight ? "var(--radius-xl)" : "var(--radius-xl)",
              borderTopRightRadius: !isRight ? "var(--radius-xl)" : 0,
              borderBottomLeftRadius: isRight ? "var(--radius-xl)" : 0,
              boxShadow: "var(--shadow-sheet)",
              backdropFilter: "blur(var(--blur-sheet))",
              WebkitBackdropFilter: "blur(var(--blur-sheet))",
              overflowY: "auto",
            }}
            initial={initialOffset}
            animate={{ ...settledOffset, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ ...initialOffset, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
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
