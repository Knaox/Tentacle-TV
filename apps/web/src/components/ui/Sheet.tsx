import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

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

const ENTER = { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const };
const EXIT = { duration: 0.2, ease: [0.4, 0, 1, 1] as const };

/**
 * Volet coulissant canonique — depuis la droite (navigation secondaire,
 * filtres, fiche d'un ticket) ou depuis le bas (sélecteurs mobiles).
 *
 * Sans AnimatePresence : monté dès l'ouverture, il joue sa sortie puis se
 * DÉMONTE à la fin de l'animation (`onAnimationComplete`). Avec
 * AnimatePresence, la sortie restait bloquée ici — le nœud n'était jamais
 * retiré, et son scrim devenu invisible gobait tous les clics de la page.
 * Démonter compte aussi pour le GPU : un `backdrop-filter` masqué n'est pas
 * gratuit (règles de CLAUDE.md).
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
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

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

  if (!mounted) return null;

  const isRight = placement === "right";
  const hiddenOffset = isRight ? { x: "100%" } : { y: "100%" };
  const shownOffset = isRight ? { x: 0 } : { y: 0 };

  const panelStyle = isRight
    ? { width: size, height: "100%", right: 0, top: 0, bottom: 0 }
    : { maxHeight: size, width: "100%", left: 0, right: 0, bottom: 0 };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[90]"
      initial={{ opacity: 0 }}
      animate={{ opacity: open ? 1 : 0, transition: { duration: open ? 0.18 : 0.12 } }}
      onClick={onClose}
      role="presentation"
      aria-hidden={!open}
      // Scrim de sheet : reste sombre dans les deux thèmes (standard iOS) — ne pas migrer.
      style={{ background: "rgba(0,0,0,0.55)", pointerEvents: open ? "auto" : "none" }}
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
          borderTopLeftRadius: "var(--radius-xl)",
          borderTopRightRadius: !isRight ? "var(--radius-xl)" : 0,
          borderBottomLeftRadius: isRight ? "var(--radius-xl)" : 0,
          boxShadow: "var(--shadow-sheet)",
          backdropFilter: "blur(var(--blur-sheet))",
          WebkitBackdropFilter: "blur(var(--blur-sheet))",
          overflowY: "auto",
        }}
        initial={hiddenOffset}
        animate={{ ...(open ? shownOffset : hiddenOffset), transition: open ? ENTER : EXIT }}
        onAnimationComplete={() => {
          if (!open) setMounted(false);
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
