import { useTranslation } from "react-i18next";
import type { MediaFilter } from "../api/types";

interface MediaTypeFilterProps {
  value: MediaFilter;
  onChange: (value: MediaFilter) => void;
}

export function MediaTypeFilter({ value, onChange }: MediaTypeFilterProps) {
  const { t } = useTranslation("seer");

  const FILTERS: { value: MediaFilter; key: string }[] = [
    { value: "all", key: "seer:filterAllType" },
    { value: "movie", key: "seer:filterMovies" },
    { value: "tv", key: "seer:filterSeries" },
    { value: "anime", key: "seer:filterAnimes" },
  ];

  return (
    <div className="flex gap-2">
      {FILTERS.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onChange(filter.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            value === filter.value
              ? "bg-purple-600 text-white"
              : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
          }`}
        >
          {t(filter.key)}
        </button>
      ))}
    </div>
  );
}
