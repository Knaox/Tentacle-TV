import { memo, useRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { FAVORITES_GROUP_MODES, type FavoritesGroupMode } from "@tentacle-tv/api-client";

const LABEL_KEYS: Record<FavoritesGroupMode, string> = {
  none: "groupNone",
  type: "groupType",
  status: "groupStatus",
  genre: "groupGenre",
  decade: "groupDecade",
};

/**
 * « Regrouper » : un contrôle segmenté (radiogroup), flèches gauche/droite
 * pour passer d'un mode à l'autre comme dans un groupe de boutons radio natif.
 * Sur écran étroit, la rangée défile horizontalement plutôt que de se
 * replier sur deux lignes.
 */
export const FavoritesGroupPicker = memo(function FavoritesGroupPicker({
  mode, onChange,
}: {
  mode: FavoritesGroupMode;
  onChange: (mode: FavoritesGroupMode) => void;
}) {
  const { t } = useTranslation("favorites");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const idx = FAVORITES_GROUP_MODES.indexOf(mode);
    const step = e.key === "ArrowRight" ? 1 : -1;
    const next = (idx + step + FAVORITES_GROUP_MODES.length) % FAVORITES_GROUP_MODES.length;
    onChange(FAVORITES_GROUP_MODES[next]);
    refs.current[next]?.focus();
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span id="favorites-group-label" className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-content-quaternary">
        {t("groupBy")}
      </span>
      <div
        role="radiogroup"
        aria-labelledby="favorites-group-label"
        onKeyDown={onKeyDown}
        className="scrollbar-hide flex min-w-0 gap-1 overflow-x-auto rounded-full border border-line-subtle bg-[var(--glass-tint)] p-1"
      >
        {FAVORITES_GROUP_MODES.map((m, i) => {
          const selected = m === mode;
          return (
            <button
              key={m}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(m)}
              className={`h-8 shrink-0 cursor-pointer rounded-full px-3.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)] ${
                selected
                  ? "bg-[rgba(var(--brand-rgb),0.22)] font-semibold text-[var(--brand-light)]"
                  : "font-medium text-content-tertiary hover:text-content-primary"
              }`}
            >
              {t(LABEL_KEYS[m])}
            </button>
          );
        })}
      </div>
    </div>
  );
});
