import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FilmSlateIcon as Clapperboard } from "@phosphor-icons/react/dist/csr/FilmSlate";
import { EyeSlashIcon as EyeOff } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { ClockCounterClockwiseIcon as History } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";
import { TelevisionIcon as Tv } from "@phosphor-icons/react/dist/csr/Television";
import type { Icon as IconType } from "@phosphor-icons/react";
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
  icon: IconType;
  label: string;
  count: number;
  active: boolean;
  onToggle: () => void;
}

/**
 * Une tuile : un compte ET un filtre. La tuile de choix du socle (`.ui-tile`) : l'encre de
 * carte au repos, le fond doux et le trait de la teinte franche une fois choisie
 * (`aria-pressed`), la pression à 97 %. La pastille d'icône suit : neutre, puis l'aplat
 * d'accent et l'icône PLEINE. Plus de dégradé de marque ni de calque de survol à part.
 * Sous le verre de macOS 26, du contenu : le remplissage des groupes (`lg-content`), la marque
 * seulement en touche (`theme/liquidGlassContent.css`).
 */
const Tile = memo(function Tile({ icon: Icon, label, count, active, onToggle }: TileProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      disabled={count === 0 && !active}
      // `border border-transparent` : sans effet ici ; sous le verre natif, `lg-content` y pose
      // son trait (`--lgd-stroke`) — il lui faut une bordure à teinter.
      className="lg-content ui-tile flex min-h-[64px] cursor-pointer border border-transparent items-center gap-3 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] disabled:cursor-default disabled:opacity-45"
    >
      <span
        aria-hidden
        className={`lg-content-badge flex h-9 w-9 shrink-0 items-center justify-center rounded-field ${
          active ? "bg-accent text-accent-on" : "bg-fill-soft text-content-secondary"
        }`}
      >
        <Icon size={18} weight={active ? "fill" : "regular"} />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-xl font-bold leading-none tabular-nums text-content-primary">{count}</span>
        {/* `text-[var(--brand-light)]` : le crochet que le verre natif vise pour le libellé d'une
            tuile choisie (`liquidGlassContent.css`) ; `[&]:text-accent`, émis après, est ce qui se
            voit hors du verre — la teinte franche. */}
        <span className={`mt-1 block truncate text-xs font-medium ${active ? "text-[var(--brand-light)] [&]:text-accent" : "text-content-tertiary"}`}>
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
      <Tile icon={Clapperboard} label={t("statMovies")} count={counts.movies} active={type === "Movie"} onToggle={() => toggleType("Movie")} />
      <Tile icon={Tv} label={t("statSeries")} count={counts.series} active={type === "Series"} onToggle={() => toggleType("Series")} />
      <Tile icon={History} label={t("statResume")} count={counts.resume} active={status === "IsResumable"} onToggle={() => toggleStatus("IsResumable")} />
      <Tile icon={EyeOff} label={t("statUnplayed")} count={counts.notPlayed} active={status === "IsUnplayed"} onToggle={() => toggleStatus("IsUnplayed")} />
    </div>
  );
});
