import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { FilmSlateIcon as Clapperboard } from "@phosphor-icons/react/dist/csr/FilmSlate";
import { FunnelXIcon as FilterX } from "@phosphor-icons/react/dist/csr/FunnelX";
import { MagnifyingGlassMinusIcon as SearchX } from "@phosphor-icons/react/dist/csr/MagnifyingGlassMinus";
import type { Icon as IconType } from "@phosphor-icons/react";
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
  const { t } = useTranslation(["common", "library"]);
  const navigate = useNavigate();
  const searching = query.trim().length > 0 && onApplyQuery !== undefined;

  if (searching) {
    return (
      <EmptyFrame icon={SearchX}>
        <p className="max-w-md text-base text-content-secondary">
          {t("common:noResultsFor", { query: query.trim(), name: scopeName })}
        </p>
        <SearchSuggestions query={query} onApply={onApplyQuery} />
        <button type="button" onClick={onReset} className="btn btn-ghost btn-sm">
          {t("common:resetSearchAndFilters")}
        </button>
      </EmptyFrame>
    );
  }

  return (
    <EmptyFrame icon={filtered ? FilterX : Clapperboard}>
      <div className="flex max-w-md flex-col gap-1.5">
        <h2 className="text-heading-2 text-content-primary">
          {filtered ? t("library:emptyFilteredTitle") : t("library:emptyTitle")}
        </h2>
        <p className="text-sm text-content-tertiary">
          {filtered ? t("library:emptyFilteredHint") : t("library:emptyHint")}
        </p>
      </div>
      <button
        type="button"
        onClick={filtered ? onReset : () => navigate("/")}
        // `cta-primary` : marqueur sans style — le moteur de focus du client LG y reconnaît
        // l'action principale de l'écran (`focus/default.ts`).
        className="btn btn-solid cta-primary"
      >
        {filtered ? t("common:resetFilters") : t("common:browseLibraries")}
      </button>
    </EmptyFrame>
  );
}

/**
 * Le cadre commun aux trois états : une pastille d'icône à l'encre de carte, le message, puis
 * la sortie. Plus d'anneau dégradé (un décor) ; aucune animation — un état vide n'a rien à
 * annoncer en boucle. Ma liste et Mes favoris le reprennent pour leurs propres états
 * (`collection/CollectionStates`).
 */
export function EmptyFrame({ icon: Icon, children }: { icon: IconType; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-5 py-16 text-center md:py-20">
      <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-content-tertiary shadow-edge">
        <Icon size={28} />
      </span>
      {children}
    </div>
  );
}
