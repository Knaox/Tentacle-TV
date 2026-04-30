import { useTranslation } from "react-i18next";

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
      className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/55 transition-colors duration-150 hover:border-white/20 hover:text-white/85 sm:w-[220px]"
    >
      <SearchIcon />
      <span className="hidden flex-1 text-left sm:inline">{t("common:searchPlaceholder")}</span>
      <kbd
        className="hidden rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-white/45 sm:inline"
      >
        {t("common:ctrlK")}
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
