import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Search, Sparkles } from "lucide-react";
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

const PRIMARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-cta-primary-border bg-cta-primary-bg px-6 text-sm font-bold text-cta-primary-fg outline-none transition-[background-color,transform] duration-150 hover:bg-cta-primary-bg-hover active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-line-focus";
const SECONDARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line-subtle bg-fill-soft px-5 text-sm font-semibold text-content-primary outline-none transition-[background-color,transform] duration-150 hover:bg-fill-medium active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-line-focus";

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
          <Sparkles aria-hidden className="h-4 w-4" strokeWidth={2.2} />
          {t("tryCorrection", { term: correction })}
        </button>
      )}
      <button type="button" className={correction === null ? PRIMARY : SECONDARY} onClick={() => openOmnibox(q)}>
        <Search aria-hidden className="h-4 w-4" strokeWidth={2.2} />
        {t("searchEverywhere")}
      </button>
    </div>
  );
});
