import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";

/**
 * `QuerySuggestions` de l'app, dans sa disposition `rail` (en tête des
 * résultats) : titre 11 en capitales, puis des pastilles de 34 (280 max) —
 * loupe 13 violet clair, requête 13 semi-gras — sur une ligne qui défile.
 */
export const QuerySuggestions = memo(function QuerySuggestions({ queries, onPick }: {
  queries: readonly string[];
  onPick: (query: string) => void;
}) {
  const { t } = useTranslation("search");
  if (queries.length === 0) return null;
  return (
    <div>
      <p className="px-4 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[0.7px] text-content-tertiary">{t("suggestions")}</p>
      <div className="mirror-no-scrollbar flex gap-1.5 overflow-x-auto px-4">
        {queries.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onPick(value)}
            aria-label={`${t("suggestions")} : ${value}`}
            className="flex h-[34px] max-w-[280px] shrink-0 items-center gap-1.5 rounded-full border border-line-subtle bg-fill-subtle px-3 active:bg-fill-soft"
          >
            <Search size={13} className="shrink-0 text-brand-light" aria-hidden />
            <span className="truncate text-[13px] font-semibold text-content-primary">{value}</span>
          </button>
        ))}
      </div>
    </div>
  );
});
