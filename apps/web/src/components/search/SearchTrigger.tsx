import { useTranslation } from "react-i18next";
import { searchShortcutLabel } from "../../lib/shortcutLabel";

interface SearchTriggerProps {
  onClick: () => void;
}

/**
 * Pill button that opens the full-screen search overlay.
 * Stays visually consistent with the topnav cluster (h-9, neutral surface).
 */
export function SearchTrigger({ onClick }: SearchTriggerProps) {
  const { t } = useTranslation("common");

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("common:searchPlaceholder")}
      className="flex items-center gap-2 rounded-md border border-line-subtle bg-fill-subtle px-3 py-2 text-sm text-content-tertiary transition-colors duration-150 hover:border-line-strong hover:text-content-secondary sm:w-[220px]"
    >
      <SearchIcon />
      <span className="hidden flex-1 text-left sm:inline">{t("common:searchPlaceholder")}</span>
      <kbd
        className="hidden rounded border border-line-subtle bg-fill-subtle px-1.5 py-0.5 text-[10px] font-medium text-content-quaternary sm:inline"
      >
        {searchShortcutLabel()}
      </kbd>
    </button>
  );
}

function SearchIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}
