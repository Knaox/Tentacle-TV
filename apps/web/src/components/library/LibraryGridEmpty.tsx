import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SearchX } from "lucide-react";
import { SearchSuggestions } from "../search/SearchSuggestions";

/**
 * Une grille qui ne rend rien — et la sortie qui va avec.
 *
 * Le message seul suffisait à la souris : il reste toujours un lien à cliquer
 * quelque part. Sur le téléviseur, non. Le moteur de focus de la LG cherche
 * d'abord la cible d'entrée de l'écran ; sans carte ni action, il ne trouve
 * rien, épuise son délai de grâce et se rabat sur ce que l'ordre de lecture
 * propose — la première puce de filtre. On arrive donc sur une page vide avec
 * l'anneau posé sur « Tous », sans que rien n'indique quoi faire.
 *
 * L'action porte les classes `cta-primary` du système de design, et c'est tout
 * ce qu'il faut : le moteur les reconnaît comme l'appel à l'action principal
 * d'un écran. Aucun attribut propre au téléviseur n'a sa place ici — c'est ce
 * qui permet à `apps/web` d'ignorer son existence.
 *
 * Trois situations, trois réponses. **Une recherche à zéro** : on dit ce qui a
 * été cherché, et l'on propose la correction du moteur de Tentacle et la
 * recherche de tout le serveur (`SearchSuggestions`) — la réinitialisation
 * passe en second. **Filtré à zéro** : c'est l'utilisateur qui a fermé la
 * porte, on lui rend la clé. **Réellement vide** : la seule chose utile est
 * d'aller voir ailleurs. Le téléviseur n'a jamais de recherche ici (son champ
 * est inerte) : il reste sur les deux dernières.
 */
export function LibraryGridEmpty({
  filtered,
  onReset,
  query = "",
  scopeName = "",
  onApplyQuery,
}: {
  /** Vrai quand une recherche ou des filtres sont actifs — donc réversible. */
  filtered: boolean;
  onReset: () => void;
  /** La recherche en cours, telle que tapée. */
  query?: string;
  /** Où l'on cherchait : « Films », « Mes favoris ». */
  scopeName?: string;
  /** Remplace la recherche par une correction proposée. */
  onApplyQuery?: (term: string) => void;
}) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const searching = query.trim().length > 0 && onApplyQuery !== undefined;

  if (searching) {
    return (
      <div className="flex flex-col items-center gap-5 py-20 text-center">
        <SearchX aria-hidden className="h-10 w-10 text-content-quaternary" strokeWidth={1.6} />
        <p className="max-w-md text-base text-content-secondary">
          {t("noResultsFor", { query: query.trim(), name: scopeName })}
        </p>
        <SearchSuggestions query={query} onApply={onApplyQuery} />
        <button
          type="button"
          onClick={onReset}
          className="text-sm font-medium text-content-tertiary underline-offset-4 transition-colors hover:text-content-primary hover:underline"
        >
          {t("resetSearchAndFilters")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-20">
      <p className="text-center text-content-quaternary">
        {filtered ? t("noResults") : t("emptyLibrary")}
      </p>
      <button
        type="button"
        onClick={filtered ? onReset : () => navigate("/")}
        className="inline-flex h-11 items-center justify-center rounded-full border border-cta-primary-border bg-cta-primary-bg px-7 text-sm font-bold text-cta-primary-fg transition-colors duration-150 hover:bg-cta-primary-bg-hover"
      >
        {filtered ? t("resetFilters") : t("browseLibraries")}
      </button>
    </div>
  );
}
