import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, Search, X } from "lucide-react";
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
      <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape" && value) { e.preventDefault(); onChange(""); } }}
        placeholder={t("search.placeholder")}
        aria-label={t("search.label")}
        className="h-10 w-full appearance-none rounded-lg border border-line-subtle bg-fill-subtle pl-9 pr-9 text-sm text-content-primary outline-none transition-colors placeholder:text-content-quaternary focus:border-line-focus focus-visible:ring-2 focus-visible:ring-line-focus [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("search.clear")}
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-content-tertiary transition-colors hover:bg-fill-soft hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <X size={15} aria-hidden />
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
    <div className="max-w-2xl">
      <p aria-live="polite" className="mb-3 px-1 text-sm text-content-tertiary">
        {hits.length > 0 ? t("search.count", { count: hits.length }) : t("search.empty", { query: query.trim() })}
      </p>
      {hits.length === 0 ? (
        <p className="px-1 text-sm text-content-quaternary">{t("search.emptyHint")}</p>
      ) : (
        <ul className="lg-content overflow-hidden rounded-xl border border-line-subtle bg-surface-1">
          {hits.map(({ entry, section, group }, i) => (
            <li key={entry.id} className={i < hits.length - 1 ? "border-b border-line-subtle" : ""}>
              <button
                type="button"
                onClick={() => { onPick(); navigate(wideSettingPath(entry.id)); }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-fill-subtle focus-visible:bg-fill-subtle focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-medium text-content-primary">{text(entry.label)}</span>
                    {entry.scope ? <ScopeBadge scope={entry.scope} /> : null}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-wider text-content-quaternary">
                    {t("search.where", { section: text(section.label), group: text(group.title) })}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-content-tertiary">{text(entry.description)}</span>
                </span>
                <ChevronRight size={16} aria-hidden className="shrink-0 text-content-quaternary" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
