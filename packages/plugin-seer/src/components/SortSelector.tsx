import type { SortOption } from "../api/types";

interface SortSelectorProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "popularity", label: "Popularite" },
  { value: "trending", label: "Tendances" },
  { value: "vote_average", label: "Note" },
  { value: "release_date", label: "Recent" },
];

export function SortSelector({ value, onChange }: SortSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SortOption)}
      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 outline-none transition-colors focus:border-purple-500"
    >
      {SORT_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-[#1a1a2e]">
          {opt.label}
        </option>
      ))}
    </select>
  );
}
