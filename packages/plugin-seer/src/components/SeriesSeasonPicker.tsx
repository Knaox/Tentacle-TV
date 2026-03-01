import { useState } from "react";
import type { SeerrSeason } from "../api/types";

interface SeriesSeasonPickerProps {
  seasons: SeerrSeason[];
  onRequest: (selectedSeasons: number[]) => void;
  requesting?: boolean;
}

export function SeriesSeasonPicker({ seasons, onRequest, requesting }: SeriesSeasonPickerProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Filter out season 0 (specials)
  const displaySeasons = seasons.filter((s) => s.seasonNumber > 0);

  const toggle = (seasonNumber: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seasonNumber)) next.delete(seasonNumber);
      else next.add(seasonNumber);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(displaySeasons.map((s) => s.seasonNumber)));
  };

  const deselectAll = () => {
    setSelected(new Set());
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">Saisons</h4>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="text-[10px] font-medium text-purple-400 hover:text-purple-300"
          >
            Tout
          </button>
          <button
            onClick={deselectAll}
            className="text-[10px] font-medium text-white/40 hover:text-white/60"
          >
            Aucun
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {displaySeasons.map((season) => (
          <button
            key={season.seasonNumber}
            onClick={() => toggle(season.seasonNumber)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all ${
              selected.has(season.seasonNumber)
                ? "border-purple-500 bg-purple-600/20 text-white"
                : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:bg-white/8"
            }`}
          >
            <div
              className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                selected.has(season.seasonNumber)
                  ? "border-purple-500 bg-purple-600"
                  : "border-white/20"
              }`}
            >
              {selected.has(season.seasonNumber) && (
                <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{season.name || `Saison ${season.seasonNumber}`}</p>
              <p className="text-[10px] text-white/30">{season.episodeCount} episodes</p>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={() => onRequest(Array.from(selected).sort((a, b) => a - b))}
        disabled={selected.size === 0 || requesting}
        className="w-full rounded-lg bg-purple-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {requesting
          ? "Envoi..."
          : `Demander ${selected.size} saison${selected.size > 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
