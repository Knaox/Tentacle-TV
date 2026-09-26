import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Titres trouvés par le filtre de la page, au bout du champ — `null` : rien à dire. */
  count: number | null;
  /** La croix : vider — et, là où la barre se replie, la refermer. */
  onClear?: () => void;
  autoFocus?: boolean;
  /** Faux : le champ ne prend pas la marge d'écran — il partage une ligne. */
  inset?: boolean;
}

/**
 * La recherche DANS une page (`search/ScopedSearchField` de l'app) : pilule
 * opaque de 44 sur `surface.s2`, liseré `border.strong` (`border.focus` au
 * focus), loupe 16 à 12 du bord, texte 15, le nombre de titres trouvés au
 * bout (13 semi-gras tertiaire, chiffres tabulaires), croix 14 dans un rond
 * de 28 `fill.soft`.
 *
 * Le panneau de suggestions de l'app (complétion grise, requêtes proposées)
 * n'est pas repris ici : la grille filtrée répond seule à la frappe.
 */
export const ScopedSearchField = memo(function ScopedSearchField({
  value, onChange, placeholder, count, onClear, autoFocus = false, inset = true,
}: Props) {
  const { t } = useTranslation("common");
  const [focused, setFocused] = useState(false);
  const active = value.trim().length > 0;

  return (
    <div role="search" className={inset ? "px-4" : "min-w-0 flex-1"}>
      <div
        className="flex h-11 items-center gap-2 rounded-full border bg-surface-2 pl-3 pr-2"
        style={{ borderColor: focused ? "var(--border-focus)" : "var(--border-strong)" }}
      >
        <Search size={16} className={focused || active ? "text-brand-light" : "text-content-tertiary"} aria-hidden />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className="min-w-0 flex-1 appearance-none bg-transparent text-[15px] tracking-[-0.075px] text-content-primary outline-none placeholder:text-content-tertiary [&::-webkit-search-cancel-button]:hidden"
        />
        {active && count !== null && (
          <span className="px-1 text-[13px] font-semibold tabular-nums text-content-tertiary" aria-live="polite">
            {count}
          </span>
        )}
        {(value !== "" || onClear) && (
          <button
            type="button"
            onClick={onClear ?? (() => onChange(""))}
            aria-label={t("clearSearch")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fill-soft"
          >
            <X size={14} className="text-content-secondary" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
});
