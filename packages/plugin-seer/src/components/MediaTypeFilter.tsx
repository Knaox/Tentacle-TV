import type { MediaFilter } from "../api/types";

interface MediaTypeFilterProps {
  value: MediaFilter;
  onChange: (value: MediaFilter) => void;
}

const FILTERS: { value: MediaFilter; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "movie", label: "Films" },
  { value: "tv", label: "Series" },
  { value: "anime", label: "Animes" },
];

export function MediaTypeFilter({ value, onChange }: MediaTypeFilterProps) {
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
          {filter.label}
        </button>
      ))}
    </div>
  );
}
