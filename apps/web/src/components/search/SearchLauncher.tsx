/**
 * Ce qui OUVRE la recherche depuis une barre : un faux champ sur desktop — on
 * le lit comme une barre de recherche, on clique dedans, l'omnibox s'ouvre à
 * sa place —, une icône sur mobile. Le rappel du raccourci est celui du
 * clavier de l'utilisateur (⌘K ou Ctrl+K).
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { searchShortcutLabel } from "../../lib/shortcutLabel";
import { openOmnibox } from "./omniboxStore";

function SearchIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" strokeLinecap="round" />
    </svg>
  );
}

export const SearchLauncher = memo(function SearchLauncher({ variant, className = "" }: {
  variant: "field" | "icon";
  className?: string;
}) {
  const { t } = useTranslation("search");
  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={() => openOmnibox()}
        aria-label={t("open")}
        title={t("open")}
        className={`flex h-9 w-9 items-center justify-center rounded-xl text-content-secondary transition-colors hover:bg-fill-subtle hover:text-content-primary ${className}`}
      >
        <SearchIcon className="h-[18px] w-[18px]" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => openOmnibox()}
      aria-label={t("open")}
      className={`group flex h-10 items-center gap-2.5 rounded-xl border border-line-subtle bg-fill-subtle px-3.5 text-left text-sm text-content-tertiary transition-colors duration-150 hover:border-line-strong hover:bg-fill-soft hover:text-content-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${className}`}
    >
      <SearchIcon className="h-4 w-4 shrink-0 transition-colors group-hover:text-[var(--brand-light)]" />
      <span className="min-w-0 flex-1 truncate">{t("launcher")}</span>
      <kbd className="hidden shrink-0 rounded-md border border-line-subtle bg-fill-soft px-1.5 py-0.5 font-sans text-[11px] font-medium text-content-quaternary xl:inline">
        {searchShortcutLabel()}
      </kbd>
    </button>
  );
});
