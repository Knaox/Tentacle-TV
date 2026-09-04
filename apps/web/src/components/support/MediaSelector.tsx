import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchItems, useSeasons, useEpisodes, useJellyfinClient } from "@tentacle-tv/api-client";
import { formatEpisodeCode } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { SeriesEpisodePicker } from "./SeriesEpisodePicker";

/**
 * Sélecteur du média concerné par un ticket : recherche Jellyfin temporisée,
 * un film se choisit directement, une série se déplie en saisons puis
 * épisodes (SeriesEpisodePicker). Sorti de SupportPanel tel quel.
 */

export interface MediaSelection {
  itemId: string;
  displayName: string;
}

export function MediaSelector({ onSelect, selection }: { onSelect: (s: MediaSelection | null) => void; selection: MediaSelection | null }) {
  const { t } = useTranslation("tickets");
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [pickedSeries, setPickedSeries] = useState<MediaItem | null>(null);
  const [pickedSeasonId, setPickedSeasonId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const client = useJellyfinClient();

  /* Ce champ était le seul à interroger le serveur à CHAQUE frappe, sans
   * temporisation — un aller-retour par caractère. Aligné sur les autres barres
   * de recherche de l'application. */
  const [deferredSearch, setDeferredSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDeferredSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data: results } = useSearchItems(deferredSearch);
  const { data: seasons } = useSeasons(pickedSeries?.Id);
  const { data: episodes } = useEpisodes(pickedSeries?.Id, pickedSeasonId ?? undefined);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const selectItem = (item: MediaItem) => {
    if (item.Type === "Series") {
      setPickedSeries(item);
      setPickedSeasonId(null);
      return;
    }
    const name = item.Type === "Episode"
      ? `${item.SeriesName} — ${formatEpisodeCode(item.ParentIndexNumber, item.IndexNumber, { style: "padded" })} — ${item.Name}`
      : item.Name;
    onSelect({ itemId: item.Id, displayName: name });
    setShowDropdown(false);
    setSearch("");
    setPickedSeries(null);
  };

  const selectEpisode = (ep: MediaItem) => {
    const name = `${pickedSeries?.Name} — ${formatEpisodeCode(ep.ParentIndexNumber, ep.IndexNumber, { style: "padded" })} — ${ep.Name}`;
    onSelect({ itemId: ep.Id, displayName: name });
    setShowDropdown(false);
    setSearch("");
    setPickedSeries(null);
    setPickedSeasonId(null);
  };

  const clear = () => {
    onSelect(null);
    setPickedSeries(null);
    setPickedSeasonId(null);
    setSearch("");
  };

  if (selection) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[rgba(var(--brand-rgb),0.3)] bg-[rgba(var(--brand-rgb),0.1)] px-3 py-2">
        <span className="flex-1 text-sm text-[var(--brand-light)] truncate">{selection.displayName}</span>
        <button onClick={clear} className="text-content-quaternary hover:text-content-primary" type="button">&times;</button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        value={search}
        onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); setPickedSeries(null); }}
        onFocus={() => setShowDropdown(true)}
        placeholder={t("tickets:searchMedia")}
        className="w-full rounded-lg border border-line-subtle bg-tentacle-surface px-4 py-2.5 text-sm text-content-primary placeholder-content-quaternary outline-none focus:ring-1 focus:ring-[rgba(var(--brand-rgb),0.5)]"
      />

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-line-subtle bg-tentacle-bg shadow-xl">
          {pickedSeries ? (
            <SeriesEpisodePicker
              series={pickedSeries}
              seasons={seasons}
              episodes={episodes}
              selectedSeasonId={pickedSeasonId}
              onSeasonChange={setPickedSeasonId}
              onEpisodeSelect={selectEpisode}
              onBack={() => setPickedSeries(null)}
              client={client}
            />
          ) : (
            <>
              {search.length < 2 && <p className="px-4 py-3 text-xs text-content-quaternary">{t("tickets:typeAtLeast")}</p>}
              {search.length >= 2 && (!results || results.length === 0) && <p className="px-4 py-3 text-xs text-content-quaternary">{t("tickets:noResults")}</p>}
              {results?.map((item) => (
                <SearchResultRow key={item.Id} item={item} client={client} onClick={() => selectItem(item)} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SearchResultRow({ item, client, onClick }: { item: MediaItem; client: any; onClick: () => void }) {
  const { t } = useTranslation("common");
  const poster = item.ImageTags?.Primary ? client.getImageUrl(item.Id, "Primary", { width: 60, quality: 80 }) : null;
  return (
    <button onClick={onClick} type="button"
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-fill-subtle">
      {poster ? (
        <img src={poster} alt="" className="h-10 w-7 rounded object-cover" />
      ) : (
        <div className="flex h-10 w-7 items-center justify-center rounded bg-fill-subtle text-xs text-content-quaternary">?</div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-content-primary truncate">{item.Name}</p>
        <p className="text-xs text-content-quaternary">
          {item.Type === "Series" ? t("common:series") : t("common:movie")}
          {item.ProductionYear ? ` — ${item.ProductionYear}` : ""}
        </p>
      </div>
      {item.Type === "Series" && <span className="text-xs text-content-quaternary">&rsaquo;</span>}
    </button>
  );
}
