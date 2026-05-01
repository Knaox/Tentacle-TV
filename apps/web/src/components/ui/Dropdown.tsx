import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type DropdownPlacement = "bottom-end" | "bottom-start" | "top-end" | "top-start";

interface DropdownProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Anchor-relative placement. */
  placement?: DropdownPlacement;
  /** Min width in px. Default 200. */
  minWidth?: number;
  /** Max width — caps the panel. Default unset. */
  maxWidth?: number;
  /** Forward className to the panel. */
  className?: string;
}

const VARIANTS = {
  hidden: { opacity: 0, scale: 0.96, y: -4 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.15, ease: [0.22, 1, 0.36, 1] as const },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: -4,
    transition: { duration: 0.1, ease: [0.4, 0, 1, 1] as const },
  },
};

/**
 * Canonical dropdown primitive — replaces 4+ ad-hoc dropdown surfaces.
 * - surface-dropdown bg, blur 12px, border-subtle, shadow-dropdown
 * - 150ms scale-in / 100ms scale-out
 * - Esc + click-outside dismiss handled by parent (use `useDropdown()` helpers
 *   or wire onClose manually — staying simple keeps the primitive trivial)
 *
 * Caller is responsible for placement; this component handles only the panel
 * styling + animation + portal-free positioning (typically `absolute right-0`
 * inside a `relative` wrapper around the trigger).
 */
export function Dropdown({
  open,
  onClose,
  children,
  placement = "bottom-end",
  minWidth = 200,
  maxWidth,
  className,
}: DropdownProps) {
  const panelRef = useRef<HTMLDivElement>(null);

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

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Defer the listener so the click that opened the dropdown doesn't immediately close it.
    const id = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handler);
    };
  }, [open, onClose]);

  const positionClass = positionClasses[placement];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          role="menu"
          aria-orientation="vertical"
          className={`absolute z-50 ${positionClass} ${className ?? ""}`}
          style={{
            minWidth,
            maxWidth,
            background: "var(--surface-dropdown)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-dropdown)",
            backdropFilter: "blur(var(--blur-dropdown))",
            WebkitBackdropFilter: "blur(var(--blur-dropdown))",
            overflow: "hidden",
          }}
          variants={VARIANTS}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const positionClasses: Record<DropdownPlacement, string> = {
  "bottom-end": "right-0 top-full mt-2 origin-top-right",
  "bottom-start": "left-0 top-full mt-2 origin-top-left",
  "top-end": "right-0 bottom-full mb-2 origin-bottom-right",
  "top-start": "left-0 bottom-full mb-2 origin-bottom-left",
};
