import { memo, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Clapperboard, EyeOff, History, Tv } from "lucide-react";
import { favoriteWatchState, summarizeFavorites, type CollectionTypeTab } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

interface FavoritesOverviewProps {
  items: MediaItem[];
  type: CollectionTypeTab;
  status: string | null;
  onTypeChange: (type: CollectionTypeTab) => void;
  onStatusChange: (status: string | null) => void;
}

interface TileProps {
  icon: ReactNode;
  label: string;
  count: number;
  active: boolean;
  onToggle: () => void;
}

/**
 * Une tuile : un compte ET un filtre. Posée sur le bas de la bannière : le
 * voile `--glass-tint` la garde lisible sans `backdrop-filter` (rien à flouter
 * qui vaille une passe de composition). Le survol passe par un calque en fondu
 * d'opacité, jamais par un `background-color` animé (règle GPU de CLAUDE.md).
 */
const Tile = memo(function Tile({ icon, label, count, active, onToggle }: TileProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      disabled={count === 0 && !active}
      className={`group relative flex min-h-[64px] cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)] disabled:cursor-default disabled:opacity-45 ${
        active
          ? "border-[rgba(var(--brand-rgb),0.45)] bg-[rgba(var(--brand-rgb),0.16)]"
          : "border-line-subtle bg-[var(--glass-tint)]"
      }`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-fill-soft opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-disabled:opacity-0"
      />
      <span
        aria-hidden
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          active ? "text-white" : "text-[var(--brand-light)]"
        }`}
        style={{
          background: active
            ? "linear-gradient(135deg, var(--brand-light), var(--brand-accent))"
            : "rgba(var(--brand-rgb), 0.14)",
        }}
      >
        {icon}
      </span>
      <span className="relative min-w-0">
        <span className="block text-xl font-bold leading-none tabular-nums text-content-primary">{count}</span>
        <span className={`mt-1 block truncate text-xs font-medium ${active ? "text-[var(--brand-light)]" : "text-content-tertiary"}`}>
          {label}
        </span>
      </span>
    </button>
  );
});

/**
 * Le bilan des titres likés, en quatre tuiles qui sont AUSSI les filtres
 * rapides de la page : Films / Séries (le type), À reprendre / Pas encore vus
 * (le statut). Les deux familles se combinent, et chacune compte dans le
 * périmètre de l'autre — choisir « Films » fait dire à « À reprendre » combien
 * de FILMS sont entamés. Toucher une tuile active la relâche.
 *
 * Les comptes suivent la définition du filtre de statut (`favoriteWatchState`,
 * verrouillée par test) : le chiffre affiché est celui qu'on obtient au clic.
 */
export const FavoritesOverview = memo(function FavoritesOverview({
  items, type, status, onTypeChange, onStatusChange,
}: FavoritesOverviewProps) {
  const { t } = useTranslation("favorites");

  const counts = useMemo(() => {
    const matchesStatus = (i: MediaItem) => {
      if (status === "IsResumable") return favoriteWatchState(i) === "resume";
      if (status === "IsUnplayed") return favoriteWatchState(i) !== "played";
      return true;
    };
    const byStatus = summarizeFavorites(items.filter(matchesStatus));
    const byType = summarizeFavorites(type === "all" ? items : items.filter((i) => i.Type === type));
    return {
      movies: byStatus.movies,
      series: byStatus.series,
      resume: byType.resume,
      notPlayed: byType.resume + byType.unplayed,
    };
  }, [items, type, status]);

  const toggleType = (next: CollectionTypeTab) => onTypeChange(type === next ? "all" : next);
  const toggleStatus = (next: string) => onStatusChange(status === next ? null : next);

  return (
    <div role="group" aria-label={t("quickFilters")} className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      <Tile icon={<Clapperboard size={18} />} label={t("statMovies")} count={counts.movies} active={type === "Movie"} onToggle={() => toggleType("Movie")} />
      <Tile icon={<Tv size={18} />} label={t("statSeries")} count={counts.series} active={type === "Series"} onToggle={() => toggleType("Series")} />
      <Tile icon={<History size={18} />} label={t("statResume")} count={counts.resume} active={status === "IsResumable"} onToggle={() => toggleStatus("IsResumable")} />
      <Tile icon={<EyeOff size={18} />} label={t("statUnplayed")} count={counts.notPlayed} active={status === "IsUnplayed"} onToggle={() => toggleStatus("IsUnplayed")} />
    </div>
  );
});
