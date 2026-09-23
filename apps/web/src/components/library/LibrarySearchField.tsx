import { useTranslation } from "react-i18next";
import { ScopedSearchField } from "../search/ScopedSearchField";

interface LibrarySearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  libraryName: string;
  /** Titres trouvés pour la recherche en cours — `null` : rien à dire. */
  resultCount?: number | null;
  /** Une recherche est en route. */
  busy?: boolean;
  /**
   * Posé dans une barre d'outils (Ma liste, Mes favoris) : le champ seul, la
   * largeur est celle que la barre lui donne. Sinon, sous la bannière, avec
   * les marges de la page.
   */
  inline?: boolean;
}

/**
 * Le champ de recherche d'une bibliothèque — et de Ma liste, Mes favoris.
 *
 * Une enveloppe fine de `ScopedSearchField`, gardée pour être SUBSTITUABLE :
 * sur un téléviseur, la recherche est une surcouche plein écran ouverte depuis
 * le rail, et un champ de saisie posé sous la bannière n'y a pas d'emploi — il
 * ferait surgir le clavier système au moindre appui vers le bas. La cible
 * webOS remplace donc CE fichier par un composant inerte
 * (`substitutionTable.ts`) ; tant que le champ vivait dans le JSX de la
 * grille, aucune substitution ne pouvait l'atteindre.
 *
 * L'état reste chez l'appelant : le remplacement n'a rien à mémoriser, et la
 * grille continue de distinguer « aucun résultat » de « bibliothèque vide » sur
 * la même valeur, vide en permanence.
 */
export function LibrarySearchField({ value, onChange, libraryName, resultCount = null, busy = false, inline = false }: LibrarySearchFieldProps) {
  const { t } = useTranslation("common");
  const field = (
    <ScopedSearchField
      value={value}
      onChange={onChange}
      placeholder={t("common:searchInLibrary", { name: libraryName })}
      resultCount={resultCount}
      busy={busy}
      relayToOmnibox
    />
  );
  if (inline) return field;
  return (
    <div className="mb-4 px-4 md:px-8">
      <div className="w-full max-w-md">{field}</div>
    </div>
  );
}
