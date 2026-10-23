/**
 * Le cadre des feuilles du hors ligne (« garder hors ligne », « supprimer »).
 *
 * Verre natif (macOS 26) : la feuille de `Modal` — une plaque `surface` d'un
 * seul ton sur le voile flouté, en portail, focus piégé (lot lg7, R3). Avant,
 * un panneau en ligne à 7 % de blanc laissait la page traverser la feuille.
 *
 * Ailleurs : le cadre d'avant, au pixel près — portail, voile, panneau en
 * ligne, Échap. PORTAIL, toujours : ouvert depuis une capsule de verre, dont
 * le `backdrop-filter` (comme un `transform`) borne les `position: fixed`, il
 * tenait dans 240 × 54 px (garde : `components/ui/glass/modalPortal.test.ts`).
 */

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Modal } from "../components/ui/Modal";
import { useLiquidGlassMode } from "../theme/glass";

interface Props {
  label: string;
  onClose: () => void;
  role?: "dialog" | "alertdialog";
  /** Largeur d'avant : `md` (448 px) ou `sm` (384 px). */
  width: "md" | "sm";
  /** Plan d'avant (`z-[200]`, `z-[210]`). */
  legacyLayer: "z-[200]" | "z-[210]";
  children: ReactNode;
}

const WIDTH = { md: { px: 448, legacy: "max-w-md" }, sm: { px: 384, legacy: "max-w-sm" } } as const;

export function OfflineSheetFrame({ label, onClose, role = "dialog", width, legacyLayer, children }: Props) {
  const native = useLiquidGlassMode() === "native";
  if (native) {
    return (
      <Modal open onClose={onClose} maxWidth={WIDTH[width].px} label={label} role={role}>
        {children}
      </Modal>
    );
  }
  return (
    <LegacyFrame label={label} onClose={onClose} role={role} width={width} legacyLayer={legacyLayer}>
      {children}
    </LegacyFrame>
  );
}

function LegacyFrame({ label, onClose, role = "dialog", width, legacyLayer, children }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <div className={`fixed inset-0 ${legacyLayer} flex items-center justify-center p-4`} role={role} aria-modal="true" aria-label={label}>
      <div className="lg-scrim absolute inset-0" style={{ background: "var(--glass-backdrop)" }} onClick={onClose} />
      <div
        className={`lg-sheet relative w-full ${WIDTH[width].legacy} origin-center animate-scale-in overflow-hidden rounded-2xl border border-line-subtle`}
        style={{
          background: "var(--surface-modal)",
          boxShadow: "var(--shadow-modal)",
          backdropFilter: "blur(var(--blur-modal))",
          WebkitBackdropFilter: "blur(var(--blur-modal))",
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
