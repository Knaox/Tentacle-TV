import { useMemo, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { FloatingLayer } from "../floating/FloatingLayer";
import type { FloatingAlign, FloatingSide } from "../floating/floatingPlacement";

export type DropdownPlacement = "bottom-end" | "bottom-start" | "top-end" | "top-start";

interface DropdownProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Côté et alignement PRÉFÉRÉS : la règle commune retourne ou décale si la fenêtre manque. */
  placement?: DropdownPlacement;
  /** Min width in px. Default 200. */
  minWidth?: number;
  /** Max width — caps the panel. Default unset. */
  maxWidth?: number;
  /** Forward className to the panel. */
  className?: string;
}

const SIDES: Record<DropdownPlacement, [FloatingSide, FloatingAlign]> = {
  "bottom-end": ["bottom", "end"],
  "bottom-start": ["bottom", "start"],
  "top-end": ["top", "end"],
  "top-start": ["top", "start"],
};

/**
 * Canonical dropdown primitive — replaces 4+ ad-hoc dropdown surfaces.
 * - surface-dropdown bg, blur 12px, border-subtle, shadow-dropdown
 * - 150ms scale-in / 100ms scale-out
 * - Échap et clic dehors ferment ; le clic sur le déclencheur reste à lui.
 *
 * L'ANCRE est le parent du composant (le `relative` qui entoure le
 * déclencheur, comme avant) ; le panneau, lui, est rendu par le calque commun
 * (`FloatingLayer`) : placé dans la fenêtre, jamais coupé, il défile dedans
 * quand elle est trop basse.
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
  const markerRef = useRef<HTMLSpanElement>(null);
  const anchor = useMemo<RefObject<Element | null>>(
    () => ({ get current() { return markerRef.current?.parentElement ?? null; } }),
    [],
  );
  const [side, align] = SIDES[placement];

  return (
    <>
      <span ref={markerRef} hidden />
      <FloatingLayer
        open={open}
        anchor={anchor}
        onDismiss={onClose}
        side={side}
        align={align}
        role="menu"
        maxWidth={maxWidth}
        className={`lg-menu overflow-y-auto overscroll-contain ${className ?? ""}`}
        style={{
          minWidth,
          width: "max-content",
          background: "var(--surface-dropdown)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-dropdown)",
          backdropFilter: "blur(var(--blur-dropdown))",
          WebkitBackdropFilter: "blur(var(--blur-dropdown))",
        }}
      >
        {children}
      </FloatingLayer>
    </>
  );
}
