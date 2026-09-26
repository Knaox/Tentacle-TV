import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useViewport } from "../useFormFactor";
import { SHEET_MAX_WIDTH } from "../responsive";

const DISMISS_THRESHOLD = 80;
/** Poignée : 14 + 4 + 16. */
const HANDLE_H = 34;
const SPRING = "transform 420ms cubic-bezier(0.32, 0.72, 0, 1)";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Paliers en fraction de l'écran : replié, déplié (défaut 0,5 / 1). */
  snapPoints?: [number, number];
  /** Libellé accessible de la feuille. */
  label?: string;
  children: ReactNode;
}

/**
 * La feuille basse de l'app (`ui/BottomSheet`) : poignée fine, fond flouté,
 * surface `glass.panel` bordée d'un filet, rayon 20 en haut, 520 de large au
 * plus (feuille de formulaire sur iPad). Deux paliers : on la tire vers le
 * haut pour la déplier, vers le bas pour la replier puis la fermer.
 *
 * Elle reste montée le temps de sa sortie, puis se DÉMONTE : son voile flouté
 * ne survit pas masqué par l'opacité (règle GPU).
 */
export function BottomSheet({ open, onClose, snapPoints = [0.5, 1], label, children }: Props) {
  const { t } = useTranslation("common");
  const { height } = useViewport();
  const minH = Math.round(height * snapPoints[0]);
  const maxH = Math.round(height * snapPoints[1]);
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setExpanded(false);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), 420);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [mounted, onClose]);

  const base = !shown ? maxH : expanded ? 0 : maxH - minH;
  const y = drag === null ? base : Math.max(0, base + drag);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    start.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (start.current !== null) setDrag(e.clientY - start.current);
  }, []);
  const onPointerUp = useCallback(() => {
    const dy = drag ?? 0;
    start.current = null;
    setDrag(null);
    if (dy > DISMISS_THRESHOLD) {
      if (expanded) setExpanded(false);
      else onClose();
    } else if (dy < -DISMISS_THRESHOLD && !expanded) {
      setExpanded(true);
    }
  }, [drag, expanded, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={label}>
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{
          background: "var(--glass-backdrop)",
          WebkitBackdropFilter: "blur(10px)",
          backdropFilter: "blur(10px)",
          opacity: shown ? 1 : 0,
          transition: "opacity 240ms ease-out",
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
        <div
          className="pointer-events-auto flex w-full flex-col rounded-t-[20px] border-t border-line-subtle bg-glass-panel"
          style={{
            maxWidth: SHEET_MAX_WIDTH,
            height: maxH,
            transform: `translateY(${y}px)`,
            transition: drag === null ? SPRING : "none",
            boxShadow: "0 -8px 24px rgba(0,0,0,0.45)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
            paddingTop: expanded ? "env(safe-area-inset-top, 0px)" : undefined,
          }}
        >
          <div
            className="flex shrink-0 cursor-grab touch-none justify-center pb-4 pt-3.5"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <span className="h-1 w-9 rounded-sm bg-fill-strong" />
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            style={{ maxHeight: (expanded ? maxH : minH) - HANDLE_H }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
