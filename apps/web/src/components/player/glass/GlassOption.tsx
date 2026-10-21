import type { ReactNode } from "react";

/**
 * Une ligne de panneau du lecteur en verre, à la manière des menus de macOS :
 * la COCHE dit l'option active, la surbrillance de marque suit le pointeur
 * (`.lgp-option`). Pas d'aplat translucide pour l'actif — sur la surface à
 * alpha, il rendait un voile gris (cf. `playerGlass.css`).
 */
export function GlassOption({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={active} onClick={onClick} className="lgp-option">
      <span className="lgp-option__check" aria-hidden="true">{active && <CheckGlyph />}</span>
      {children}
    </button>
  );
}

export function CheckGlyph() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 6.5 5 9l4.5-6" />
    </svg>
  );
}

/** L'étiquette d'une option (langue, codec, HDR…) : un trait plein. */
export function GlassChip({ children }: { children: ReactNode }) {
  return <span className="lgp-chip">{children}</span>;
}
