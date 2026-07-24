import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface FilterMenuProps {
  label: string;
  /** Résumé de la sélection — remplace le libellé quand un filtre est posé. */
  value?: string | null;
  /** Efface ce filtre depuis la pastille, sans ouvrir le menu. */
  onClear?: () => void;
  /** Largeur du panneau. Les listes longues en demandent davantage. */
  width?: number;
  children: ReactNode;
}

/**
 * Filtre en menu ancré : une pastille qui ouvre un petit panneau juste
 * dessous, la grille restant visible derrière.
 *
 * Remplace le grand panneau latéral, qui recouvrait tout l'écran pour poser un
 * genre : on filtrait à l'aveugle, sans jamais voir l'effet sur les résultats
 * avant d'avoir refermé le panneau.
 */
export function FilterMenu({ label, value, onClear, width = 260, children }: FilterMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = Boolean(value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        // Mêmes valeurs que `chipCls` (LibraryFilters) : la barre mélange les
        // deux composants, une seule pastille au style différent se voit
        // immédiatement. Fond opaque pour la même raison — ces contrôles
        // reposent sur la bannière et se perdaient sur une affiche claire.
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
          active
            ? "bg-[color:var(--surface-2)] bg-[linear-gradient(rgba(var(--brand-rgb),0.24),rgba(var(--brand-rgb),0.24))] text-[var(--brand-light)] ring-1 ring-[rgba(var(--brand-rgb),0.6)]"
            : "bg-[color:var(--surface-2)] text-content-secondary ring-1 ring-line-strong shadow-[var(--elev-1)] hover:bg-fill-medium hover:text-content-primary"
        }`}
      >
        {active && (
          <span
            aria-hidden
            className="h-3 w-[2px] rounded-full"
            style={{ background: "linear-gradient(180deg, var(--brand-light), var(--brand-accent))" }}
          />
        )}
        <span className="max-w-[14rem] truncate">{value || label}</span>
        {active && onClear ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Effacer ${label}`}
            onClick={(e) => { e.stopPropagation(); onClear(); setOpen(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onClear(); setOpen(false); } }}
            className="-mr-1 flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-[rgba(var(--brand-rgb),0.3)]"
          >
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </span>
        ) : (
          <svg
            className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 top-full z-40 mt-2 origin-top-left overflow-hidden rounded-[var(--radius-lg)] bg-surface-dropdown p-3 backdrop-blur-[var(--blur-dropdown)]"
            style={{ width, boxShadow: "var(--shadow-dropdown)" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
