import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PenLine, Search } from "lucide-react";
import { useTentacleSearch } from "@tentacle-tv/api-client";
import { foldForSearch } from "@tentacle-tv/shared";

/**
 * Une recherche LOCALE sans réponse (`search/ScopedSearchEmpty` de l'app) :
 * loupe 28 quaternaire, « Rien dans la bibliothèque pour « … » » en 16
 * semi-gras, puis les sorties — la correction du moteur (dès trois lettres)
 * appliquée sur place, et « Chercher dans tout Tentacle ». Boutons pilule de
 * 44, marge 18 ; le premier est plein (`cta.primary`), l'autre en `fill.soft`.
 *
 * Les résultats des extensions (« Pas encore sur le serveur ») de l'app ne
 * sont pas repris : la recherche globale les montre.
 */
export const ScopedSearchEmpty = memo(function ScopedSearchEmpty({ query, onApply }: {
  query: string;
  /** Remplace la recherche locale par la correction proposée. */
  onApply: (term: string) => void;
}) {
  const { t } = useTranslation("common");
  const { t: ts } = useTranslation("search");
  const navigate = useNavigate();
  const q = query.trim();
  const { data } = useTentacleSearch(q, { limit: 1, enabled: q.length >= 3 });
  const correction = data?.correction && foldForSearch(data.correction) !== foldForSearch(q) ? data.correction : null;

  const primary = "bg-cta-primary-bg text-cta-primary-fg font-bold";
  const secondary = "bg-fill-soft border border-line-subtle text-content-primary font-semibold";

  return (
    <div className="flex flex-col items-center gap-2 px-5 pb-5 pt-6">
      <Search size={28} className="text-content-quaternary" aria-hidden />
      <p className="text-center text-base font-semibold leading-[22px] text-content-secondary">
        {ts("noLibraryResults", { query: q })}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {correction !== null && (
          <button
            type="button"
            onClick={() => onApply(correction)}
            className={`flex min-h-[44px] items-center gap-[7px] rounded-full px-[18px] text-sm active:opacity-75 ${primary}`}
          >
            <PenLine size={15} aria-hidden />
            {t("tryCorrection", { term: correction })}
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate(`/search?q=${encodeURIComponent(q)}`)}
          className={`flex min-h-[44px] items-center gap-[7px] rounded-full px-[18px] text-sm active:opacity-75 ${
            correction === null ? primary : secondary
          }`}
        >
          <Search size={15} aria-hidden />
          {t("searchEverywhere")}
        </button>
      </div>
    </div>
  );
});
