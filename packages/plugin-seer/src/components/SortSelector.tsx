import { useTranslation } from "react-i18next";
import type { SortOption } from "../api/types";

interface SortSelectorProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export function SortSelector({ value, onChange }: SortSelectorProps) {
  const { t } = useTranslation("seer");

  const SORT_OPTIONS: { value: SortOption; key: string }[] = [
    { value: "popularity", key: "seer:sortPopularity" },
    { value: "trending", key: "seer:sortTrending" },
    { value: "vote_average", key: "seer:sortRating" },
    { value: "release_date", key: "seer:sortRecent" },
  ];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SortOption)}
      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 outline-none transition-colors focus:border-purple-500"
    >
      {SORT_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-[#1a1a2e]">
          {t(opt.key)}
        </option>
      ))}
    </select>
  );
}
