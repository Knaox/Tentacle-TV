import { memo } from "react";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal } from "lucide-react";

/**
 * Le bouton de filtres à côté du champ (`FilterButton` de `LibrariesScreen`) :
 * rond de 44, liseré `border.strong` sur `surface.s2` ; actif, liseré
 * `border.focus` sur `brand.soft`, icône `brand.light`, et son nombre dans une
 * pastille violette de 17 en haut à droite (texte 10 extra-gras).
 *
 * `variant="soft"` : la version des collections (`CollectionFilterHeader`),
 * sans liseré, sur `fill.subtle`, pastille de 18.
 */
export const FilterButton = memo(function FilterButton({ count, onPress, label, variant = "outlined" }: {
  count: number;
  onPress: () => void;
  /** Libellé accessible (« Filtres » ou « Trier et filtrer »). */
  label?: string;
  variant?: "outlined" | "soft";
}) {
  const { t } = useTranslation("common");
  const active = count > 0;
  const name = label ?? t("filters");
  const outlined = variant === "outlined";
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={active ? `${name} (${count})` : name}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform duration-100 active:scale-[0.96] active:opacity-75"
      style={{
        background: active ? "var(--brand-soft)" : outlined ? "var(--surface-2)" : "var(--fill-subtle)",
        border: outlined ? `1px solid ${active ? "var(--border-focus)" : "var(--border-strong)"}` : undefined,
      }}
    >
      <SlidersHorizontal size={18} className={active ? "text-brand-light" : "text-content-secondary"} aria-hidden />
      {active && (
        <span
          className={`absolute flex items-center justify-center rounded-full px-1 font-extrabold text-cta-brand-fg ${
            outlined ? "-right-[3px] -top-[3px] h-[17px] min-w-[17px] text-[10px]" : "-right-0.5 -top-0.5 h-[18px] min-w-[18px] text-[11px]"
          }`}
          style={{ background: "var(--brand)" }}
        >
          {count}
        </span>
      )}
    </button>
  );
});
