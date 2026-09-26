import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";

/**
 * La pastille des feuilles de filtres (`filters/FilterChip` de l'app) : 40 de
 * haut, 14 de marge, pilule `fill.subtle` bordée ; choisie, fond `brand.soft`,
 * liseré `brand.glow` et une coche 14 devant — l'état se lit sans la couleur.
 * Texte 14 medium (semi-gras choisi).
 */
export function FilterChip({ label, active, onPress, ariaLabel }: {
  label: string;
  active: boolean;
  onPress: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={active}
      aria-label={ariaLabel ?? label}
      className="flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 active:opacity-80"
      style={{
        background: active ? "var(--brand-soft)" : "var(--fill-subtle)",
        borderColor: active ? "var(--brand-glow)" : "var(--border-subtle)",
      }}
    >
      {active && <Check size={14} className="text-brand-light" aria-hidden />}
      <span className={`truncate text-sm ${active ? "font-semibold text-brand-light" : "font-medium text-content-secondary"}`}>
        {label}
      </span>
    </button>
  );
}

/** Une section de feuille (`FilterSection`) : titre 10 gras capitales tertiaire, pastilles en retour à la ligne (écart 8). */
export function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.8px] text-content-tertiary">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

export interface ActiveChip {
  key: string;
  label: string;
  remove: () => void;
}

/**
 * Ce qui filtre, en pastilles qu'on retire d'un toucher (`LibraryFilterBar`,
 * `CollectionFilterHeader`) : 36 de haut, fond `brand.soft`, liseré
 * `brand.glow`, texte 13 semi-gras `brand.light`, croix 14 ; puis
 * « Réinitialiser » en 13 secondaire. Rangée défilante, marges 16.
 */
export const ActiveFilterChips = memo(function ActiveFilterChips({ chips, onReset, className }: {
  chips: ActiveChip[];
  onReset: () => void;
  className?: string;
}) {
  const { t } = useTranslation("common");
  if (chips.length === 0) return null;
  return (
    <div className={`mirror-no-scrollbar flex items-center gap-2 overflow-x-auto px-4 ${className ?? ""}`}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.remove}
          aria-label={t("removeFilterNamed", { name: chip.label })}
          className="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border px-3 active:opacity-80"
          style={{ background: "var(--brand-soft)", borderColor: "var(--brand-glow)" }}
        >
          <span className="whitespace-nowrap text-[13px] font-semibold text-brand-light">{chip.label}</span>
          <X size={14} className="text-brand-light" aria-hidden />
        </button>
      ))}
      <button type="button" onClick={onReset} className="flex min-h-[36px] shrink-0 items-center px-2 active:opacity-70">
        <span className="whitespace-nowrap text-[13px] font-medium text-content-secondary">{t("resetFilters")}</span>
      </button>
    </div>
  );
});
