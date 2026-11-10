import { memo } from "react";
import { useTranslation } from "react-i18next";
import { creditRoleKey, type CreditRole, type FilmographyFacets, type FilmographyKind } from "@tentacle-tv/shared";
import { SegmentedControl } from "../library/SegmentedControl";
import { chipCls } from "../library/filterChip";

interface FilmographyFiltersProps {
  facets: FilmographyFacets;
  kind: FilmographyKind;
  role: CreditRole | null;
  onKind: (kind: FilmographyKind) => void;
  onRole: (role: CreditRole | null) => void;
}

/**
 * Films / séries en contrôle segmenté (trois états exclusifs, chacun avec son
 * compte), puis le métier en pastilles de filtre — les mêmes que celles des
 * bibliothèques. Une rangée qui ne départagerait rien (que des films, un seul
 * rôle) n'est pas affichée : un filtre sans choix n'est qu'un bruit.
 */
export const FilmographyFilters = memo(function FilmographyFilters({ facets, kind, role, onKind, onRole }: FilmographyFiltersProps) {
  const { t } = useTranslation("media");
  const kinds: Array<{ value: FilmographyKind; label: string; count: number }> = [
    { value: "all", label: t("personFilterAll"), count: facets.total },
    { value: "movie", label: t("personFilterMovies"), count: facets.movies },
    { value: "series", label: t("personFilterSeries"), count: facets.series },
  ];
  const showKinds = facets.movies > 0 && facets.series > 0;
  const showRoles = facets.roles.length > 1;
  if (!showKinds && !showRoles) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      {showKinds && (
        <SegmentedControl
          label={t("personInLibraryTitle")}
          markerId="person-kind-marker"
          options={kinds}
          value={kind}
          onChange={onKind}
        />
      )}
      {showRoles && (
        <div role="group" aria-label={t("personFilterRoleAll")} className="flex flex-wrap gap-2">
          <Chip active={role === null} onClick={() => onRole(null)} label={t("personFilterRoleAll")} />
          {facets.roles.map((r) => (
            <Chip
              key={r.role}
              active={role === r.role}
              onClick={() => onRole(role === r.role ? null : r.role)}
              label={t(creditRoleKey(r.role))}
              count={r.count}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/** Une pastille de métier : la pastille de filtre des bibliothèques (`chipCls`), avec son compte. */
function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`${chipCls(active)} inline-flex items-center`}>
      {label}
      {count !== undefined && <span className="ml-1.5 tabular-nums opacity-70">{count}</span>}
    </button>
  );
}
