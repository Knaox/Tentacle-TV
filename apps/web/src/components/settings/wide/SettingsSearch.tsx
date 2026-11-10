import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CaretRightIcon as ChevronRight } from "@phosphor-icons/react/dist/csr/CaretRight";
import { MagnifyingGlassIcon as Search } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { XIcon as X } from "@phosphor-icons/react/dist/csr/X";
import { searchWideSettings, wideSettingPath, type WideSettingsContext } from "@tentacle-tv/shared";
import { ScopeBadge } from "../ScopeBadge";
import { useCatalogText } from "./wideSettingsMeta";

/**
 * Le champ en tête du rail (macOS, Windows, Android : une recherche dès que
 * les réglages dépassent un écran). Effet immédiat, sans validation ; Échap
 * l'efface.
 */
export function SettingsSearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation("settingsWeb");
  return (
    <div className="relative">
      <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-content-tertiary" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape" && value) { e.preventDefault(); onChange(""); } }}
        placeholder={t("search.placeholder")}
        aria-label={t("search.label")}
        className="field appearance-none pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("search.clear")}
          className="icon-btn btn-sm absolute right-1 top-1/2 -translate-y-1/2"
        >
          <X size={15} weight="bold" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Les résultats, à la place de la rubrique : chaque réglage trouvé avec sa
 * portée, OÙ il vit (« Lecture › Connexion ») et ce qu'il fait ; un clic mène
 * à la ligne (`/settings/<rubrique>#<id>`), soulignée à l'arrivée.
 */
export const SettingsSearchResults = memo(function SettingsSearchResults({ query, ctx, onPick }: {
  query: string;
  ctx: WideSettingsContext;
  onPick: () => void;
}) {
  const { t } = useTranslation("settingsWeb");
  const text = useCatalogText();
  const navigate = useNavigate();
  const hits = useMemo(() => searchWideSettings(query, ctx, text), [query, ctx, text]);

  return (
    <div className="max-w-3xl">
      <p aria-live="polite" className="mb-3 px-1 text-sm text-content-tertiary">
        {hits.length > 0 ? t("search.count", { count: hits.length }) : t("search.empty", { query: query.trim() })}
      </p>
      {hits.length === 0 ? (
        <p className="px-1 text-sm text-content-quaternary">{t("search.emptyHint")}</p>
      ) : (
        <ul className="lg-content ui-panel overflow-hidden">
          {hits.map(({ entry, section, group }) => (
            <li key={entry.id} className="border-line-subtle [&:not(:first-child)]:border-t">
              <button
                type="button"
                onClick={() => { onPick(); navigate(wideSettingPath(entry.id), { replace: true }); }}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors duration-hover hover:bg-fill-faint focus-visible:bg-fill-faint focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[15px] font-semibold leading-snug text-content-primary">{text(entry.label)}</span>
                    {entry.scope ? <ScopeBadge scope={entry.scope} /> : null}
                    {/* Replié sous « Avancé » dans sa page : le dire ici, le résultat l'ouvrira. */}
                    {entry.advanced ? <span className="chip">{t("advanced.inFold")}</span> : null}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-content-tertiary">
                    {t("search.where", { section: text(section.label), group: text(group.title) })}
                  </span>
                  <span className="mt-1 block max-w-[62ch] text-[13px] leading-relaxed text-content-secondary">{text(entry.description)}</span>
                </span>
                <ChevronRight size={16} aria-hidden className="shrink-0 text-content-tertiary" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
