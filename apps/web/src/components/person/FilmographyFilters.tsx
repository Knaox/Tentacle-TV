import { memo } from "react";
import { useTranslation } from "react-i18next";
import { creditRoleKey, type CreditRole, type FilmographyFacets, type FilmographyKind } from "@tentacle-tv/shared";

interface FilmographyFiltersProps {
  facets: FilmographyFacets;
  kind: FilmographyKind;
  role: CreditRole | null;
  onKind: (kind: FilmographyKind) => void;
  onRole: (role: CreditRole | null) => void;
}

/**
 * Films / séries, puis le métier — deux rangées de pastilles, chacune avec son
 * compte. Une rangée qui ne départagerait rien (que des films, un seul rôle)
 * n'est pas affichée : un filtre sans choix n'est qu'un bruit.
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
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      {showKinds && (
        <div role="group" aria-label={t("personInLibraryTitle")} className="inline-flex rounded-full border border-line-subtle bg-fill-subtle p-1">
          {kinds.map((k) => (
            <button
              key={k.value}
              type="button"
              aria-pressed={kind === k.value}
              onClick={() => onKind(k.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                kind === k.value
                  ? "bg-[rgba(var(--brand-rgb),0.2)] text-content-primary ring-1 ring-[rgba(var(--brand-rgb),0.45)]"
                  : "text-content-tertiary hover:text-content-primary"
              }`}
            >
              {k.label} <span className="tabular-nums text-content-quaternary">{k.count}</span>
            </button>
          ))}
        </div>
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

function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-[rgba(var(--brand-rgb),0.55)] bg-[rgba(var(--brand-rgb),0.16)] text-content-primary"
          : "border-line-subtle text-content-tertiary hover:border-line-strong hover:text-content-primary"
      }`}
    >
      {label}
      {count !== undefined && <span className="ml-1.5 tabular-nums text-content-quaternary">{count}</span>}
    </button>
  );
}
