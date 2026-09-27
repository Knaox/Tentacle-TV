import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { EyeOff, History, Layers } from "lucide-react";
import { FAVORITES_GROUP_MODES, favoriteWatchState, type FavoritesGroupMode } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

const GROUP_LABELS: Record<FavoritesGroupMode, string> = {
  none: "groupNone",
  type: "groupType",
  status: "groupStatus",
  genre: "groupGenre",
  decade: "groupDecade",
};

/**
 * Sous la barre de filtres de Mes favoris (`favorites/FavoritesQuickRow` de
 * l'app) : deux tuiles d'état, 56 de haut, qui comptent ET filtrent
 * (À reprendre, Pas encore vus — comptées dans le type choisi), puis la
 * rangée « Regrouper » en pastilles de 36 qui défile d'un doigt.
 */
export const FavoritesQuickRow = memo(function FavoritesQuickRow({
  items, type, status, onStatusChange, groupMode, onGroupModeChange,
}: {
  items: MediaItem[];
  type: string;
  status: string | null;
  onStatusChange: (status: string | null) => void;
  groupMode: FavoritesGroupMode;
  onGroupModeChange: (mode: FavoritesGroupMode) => void;
}) {
  const { t } = useTranslation("favorites");
  const counts = useMemo(() => {
    let resume = 0;
    let notPlayed = 0;
    for (const item of items) {
      if (type !== "all" && item.Type !== type) continue;
      const state = favoriteWatchState(item);
      if (state === "resume") resume++;
      if (state !== "played") notPlayed++;
    }
    return { resume, notPlayed };
  }, [items, type]);

  const tiles = [
    { key: "IsResumable", Icon: History, label: t("statResume"), count: counts.resume },
    { key: "IsUnplayed", Icon: EyeOff, label: t("statUnplayed"), count: counts.notPlayed },
  ];

  return (
    <div className="flex flex-col gap-2.5 pb-3">
      <div role="group" aria-label={t("quickFilters")} className="grid grid-cols-2 gap-2 px-4">
        {tiles.map(({ key, Icon, label, count }) => {
          const active = status === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              disabled={count === 0 && !active}
              onClick={() => onStatusChange(active ? null : key)}
              className="flex min-h-[56px] items-center gap-2.5 rounded-2xl border px-3 text-left active:opacity-80 disabled:opacity-45"
              style={{
                background: active ? "var(--brand-soft)" : "var(--fill-subtle)",
                borderColor: active ? "var(--brand-glow)" : "var(--border-subtle)",
              }}
            >
              <span
                aria-hidden
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${active ? "text-white" : "text-brand-light"}`}
                style={{ background: active ? "linear-gradient(135deg, var(--brand-light), var(--brand-accent))" : "rgba(var(--brand-rgb), 0.14)" }}
              >
                <Icon size={16} />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-bold leading-none tabular-nums text-content-primary">{count}</span>
                <span className={`mt-0.5 block truncate text-xs ${active ? "font-semibold text-brand-light" : "font-medium text-content-tertiary"}`}>{label}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto px-4 scrollbar-hide" role="radiogroup" aria-label={t("groupBy")}>
        <Layers size={16} className="shrink-0 text-content-tertiary" aria-hidden />
        {FAVORITES_GROUP_MODES.map((mode) => {
          const selected = mode === groupMode;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onGroupModeChange(mode)}
              className={`min-h-[36px] shrink-0 rounded-full border px-3.5 text-[13px] active:opacity-80 ${
                selected ? "font-semibold text-brand-light" : "font-medium text-content-secondary"
              }`}
              style={{
                background: selected ? "var(--brand-soft)" : "transparent",
                borderColor: selected ? "var(--brand-glow)" : "var(--border-subtle)",
              }}
            >
              {t(GROUP_LABELS[mode])}
            </button>
          );
        })}
      </div>
    </div>
  );
});
