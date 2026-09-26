import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { SHEET_MAX_WIDTH } from "../responsive";

const DISMISS = 80;
const SPRING = "transform 380ms cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * La feuille à hauteur de contenu de l'app (`MediaActionSheet`, `RecoActionSheet`,
 * les feuilles de filtres) : poignée 38×4, surface `glass.panel`, rayon 20 en
 * haut, 520 au plus, voile flouté ; on la tire vers le bas pour la fermer.
 * Démontée après sa sortie (règle GPU : pas de flou survivant sous l'opacité).
 */
export function ActionSheet({ open, onClose, label, children }: {
  open: boolean;
  onClose: () => void;
  label?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation("common");
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), 380);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    start.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (start.current !== null) setDrag(Math.max(0, e.clientY - start.current));
  }, []);
  const onPointerUp = useCallback(() => {
    start.current = null;
    if (drag > DISMISS) onClose();
    setDrag(0);
  }, [drag, onClose]);

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
          className="pointer-events-auto max-h-[92vh] w-full overflow-y-auto overscroll-contain rounded-t-[20px] border-t border-line-subtle bg-glass-panel"
          style={{
            maxWidth: SHEET_MAX_WIDTH,
            transform: shown ? `translateY(${drag}px)` : "translateY(100%)",
            transition: drag > 0 ? "none" : SPRING,
            boxShadow: "0 -8px 24px rgba(0,0,0,0.45)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
          }}
        >
          <div
            className="flex touch-none justify-center pb-1.5 pt-3"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <span className="h-1 w-[38px] rounded-sm bg-fill-strong" />
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
