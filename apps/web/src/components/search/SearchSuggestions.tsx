import { memo } from "react";
import { useTranslation } from "react-i18next";
import { MagnifyingGlassIcon as Search } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { SparkleIcon as Sparkles } from "@phosphor-icons/react/dist/csr/Sparkle";
import { useTentacleSearch } from "@tentacle-tv/api-client";
import { foldForSearch } from "@tentacle-tv/shared";
import { openOmnibox } from "./omniboxStore";

/**
 * Quand une recherche locale (bibliothèque, liste) ne rend rien : les deux
 * sorties utiles.
 *
 * - « Essayer « dune » » : la correction que propose le MOTEUR de Tentacle,
 *   qui tolère les fautes — Jellyfin, lui, compare lettre à lettre et
 *   « dnue » ne trouve rien. La correction s'applique ici, sur place.
 * - « Chercher dans tout Tentacle » : le même texte dans l'omnibox, qui voit
 *   toutes les bibliothèques, les personnes, les genres.
 *
 * Le moteur n'est interrogé qu'à partir de trois lettres, et une fois par
 * texte (cache de `useTentacleSearch`).
 */

// Les pilules du socle : l'action neutre principale, puis la secondaire.
// `cta-primary` : marqueur SANS style — le moteur de focus du client LG y reconnaît
// l'action principale d'un écran (`[class*="cta-primary"]`).
const PRIMARY = "btn btn-solid cta-primary";
const SECONDARY = "btn btn-soft";

export const SearchSuggestions = memo(function SearchSuggestions({ query, onApply }: {
  query: string;
  /** Remplace la recherche locale par la correction proposée. */
  onApply: (term: string) => void;
}) {
  const { t } = useTranslation("common");
  const q = query.trim();
  const { data } = useTentacleSearch(q, { limit: 1, enabled: q.length >= 3 });
  const correction = data?.correction && foldForSearch(data.correction) !== foldForSearch(q) ? data.correction : null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {correction !== null && (
        <button type="button" className={PRIMARY} onClick={() => onApply(correction)}>
          <Sparkles aria-hidden size={16} />
          {t("tryCorrection", { term: correction })}
        </button>
      )}
      <button type="button" className={correction === null ? PRIMARY : SECONDARY} onClick={() => openOmnibox(q)}>
        <Search aria-hidden size={16} />
        {t("searchEverywhere")}
      </button>
    </div>
  );
});
