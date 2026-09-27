/**
 * Style commun à tous les chips de la barre de filtre (statut, favoris, filtres
 * avancés, genres), partagé avec `FilterMenu` — cf. `CHIP_BASE`, réexporté par
 * `LibraryFilters` (la cible webOS le lit depuis ce module-là).
 *
 * Fond OPAQUE (`--surface-2`), et c'est un changement de fond, pas de goût.
 * Ces pastilles reposent SUR la bannière de la bibliothèque : un `bg-fill-subtle`
 * translucide et un `ring-line-subtle` s'y perdaient entièrement dès que
 * l'affiche est claire — en thème clair, sur une image d'animé pastel,
 * « Non vus » et « En cours » devenaient carrément illisibles. Un contrôle doit
 * se lire avant d'être survolé, quelle que soit l'image derrière.
 *
 * L'état actif garde sa teinte de marque, posée en dégradé PAR-DESSUS l'aplat
 * opaque : superposer les deux préserve le repère colorimétrique sans revenir à
 * une transparence qui dépend de l'affiche.
 *
 * `backdrop-blur` retiré : il n'y a plus rien à voir au travers, et il coûtait
 * une passe de compositing par pastille, huit fois par barre.
 */
export const CHIP_BASE =
  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-rgb),0.8)]";
const CHIP_IDLE =
  "bg-[color:var(--surface-2)] text-content-secondary ring-1 ring-line-strong shadow-[var(--elev-1)] hover:bg-fill-medium hover:text-content-primary";

export function chipCls(active: boolean, accent: "violet" | "rose" = "violet"): string {
  if (!active) return `${CHIP_BASE} ${CHIP_IDLE}`;
  if (accent === "rose") {
    return `${CHIP_BASE} bg-[color:var(--surface-2)] bg-[linear-gradient(rgba(var(--brand-accent-rgb),0.22),rgba(var(--brand-accent-rgb),0.22))] text-[var(--brand-accent-light)] ring-1 ring-[rgba(var(--brand-accent-rgb),0.55)]`;
  }
  return `${CHIP_BASE} bg-[color:var(--surface-2)] bg-[linear-gradient(rgba(var(--brand-rgb),0.24),rgba(var(--brand-rgb),0.24))] text-[var(--brand-light)] ring-1 ring-[rgba(var(--brand-rgb),0.6)]`;
}

export function HeartIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 21s-7.5-4.5-9.5-9.2C1 8.2 3.2 5 6.5 5c2 0 3.6 1.1 4.5 2.4 1-1.3 2.5-2.4 4.5-2.4 3.3 0 5.5 3.2 4 6.8C19.5 16.5 12 21 12 21z" />
    </svg>
  ) : (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

/** Les statuts de visionnage proposés en accès direct. */
export const STATUS_QUICK = [
  { value: null, key: "allFilter" },
  { value: "IsUnplayed", key: "unwatched" },
  { value: "IsResumable", key: "inProgress" },
] as const;
