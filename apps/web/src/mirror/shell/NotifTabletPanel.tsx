import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { HEADER_TOTAL } from "./metrics";

/** Largeur du panneau (`NotificationPanelTablet` du mobile : 400 pt). */
const PANEL_WIDTH = 400;
const FADE_MS = 180;

/**
 * Les notifications sur TABLETTE — le panneau du mobile sur iPad
 * (`NotificationPanelTablet`, session notifs) : ancré sous la cloche, en
 * haut à droite, 400 de large, 80 % de la hauteur au plus, sur un voile léger
 * (pas de flou : rien à flouter derrière un voile presque transparent). Le
 * téléphone garde la feuille du bas. Échap ou un toucher sur le voile le
 * ferme ; le panneau se DÉMONTE après sa sortie (règle GPU : rien de caché
 * qui consomme).
 */
export function NotifTabletPanel({ open, onClose, label, children }: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), FADE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-black/20 transition-opacity motion-reduce:transition-none"
        style={{ opacity: shown ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="absolute right-3 flex flex-col overflow-hidden rounded-2xl border border-line-subtle bg-[color:var(--surface-sheet)] shadow-2xl outline-none transition-[opacity,transform] ease-out motion-reduce:transition-none"
        style={{
          top: `calc(${HEADER_TOTAL} + 6px)`,
          width: PANEL_WIDTH,
          maxWidth: "calc(100vw - 24px)",
          maxHeight: "80vh",
          opacity: shown ? 1 : 0,
          transform: shown ? "translateY(0)" : "translateY(-8px)",
          transitionDuration: `${FADE_MS}ms`,
        }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
