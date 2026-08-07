import { useTranslation } from "react-i18next";

interface LibrarySearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  libraryName: string;
}

/**
 * Le champ de recherche d'une bibliothèque.
 *
 * Extrait de `LibraryGrid` pour être SUBSTITUABLE : sur un téléviseur, la
 * recherche est une surcouche plein écran ouverte depuis le rail, et un champ
 * de saisie posé sous la bannière n'y a pas d'emploi — il ferait surgir le
 * clavier système au moindre appui vers le bas. La cible webOS le remplace donc
 * par un composant inerte. Tant qu'il vivait dans le JSX de la grille, aucune
 * substitution ne pouvait l'atteindre.
 *
 * L'état reste chez l'appelant : le remplacement n'a rien à mémoriser, et la
 * grille continue de distinguer « aucun résultat » de « bibliothèque vide » sur
 * la même valeur, vide en permanence.
 *
 * En verre, car il chevauche le bas de la bannière : un aplat opaque y ferait
 * une marche visible. Le champ repose SUR l'affiche — `bg-glass-tint` (une
 * teinte à peine posée) et `ring-line-subtle` s'y perdaient complètement, et
 * sur une affiche lumineuse on ne distinguait plus ni le contour ni le texte
 * d'invite. Fond opaque de surface et liseré franc : c'est un contrôle, il doit
 * se lire comme tel avant même d'être survolé. L'icône et l'invite montent d'un
 * cran de contraste pour la même raison.
 */
export function LibrarySearchField({ value, onChange, libraryName }: LibrarySearchFieldProps) {
  const { t } = useTranslation("common");

  return (
    <div className="mb-4 px-4 md:px-8">
      <div className="relative w-full max-w-md">
        <svg
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-content-secondary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("common:searchInLibrary", { name: libraryName })}
          className="w-full rounded-full bg-[color:var(--surface-2)] py-3 pl-11 pr-5 text-content-primary placeholder-content-tertiary shadow-[var(--elev-2)] outline-none ring-1 ring-line-strong transition-all focus:ring-2 focus:ring-[rgba(var(--brand-rgb),0.75)]"
        />
      </div>
    </div>
  );
}
