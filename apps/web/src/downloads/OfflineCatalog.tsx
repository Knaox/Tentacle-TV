/**
 * Catalogue local — page d'accueil du mode Hors ligne (desktop).
 * Grille d'affiches servies par tentacle-local://, filtres Films/Séries,
 * recherche locale, fiche locale (OfflineItemSheet), lien vers la gestion.
 * Seuls les téléchargements COMPLETS et lisibles du compte sont montrés.
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { localResourceUrl, type DownloadEntry } from "./api";
import { useDownloadsList } from "./useDownloadState";
import { OfflineItemSheet } from "./OfflineItemSheet";

type Filter = "all" | "movies" | "series";

export function OfflineCatalog() {
  const { t } = useTranslation(["downloads", "nav"]);
  const entries = useDownloadsList();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DownloadEntry | null>(null);

  const complete = useMemo(() => entries.filter((e) => e.status === "complete"), [entries]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return complete.filter((entry) => {
      if (filter === "movies" && entry.kind === "episode") return false;
      if (filter === "series" && entry.kind !== "episode") return false;
      if (!needle) return true;
      return (
        (entry.title ?? "").toLowerCase().includes(needle) ||
        (entry.seriesName ?? "").toLowerCase().includes(needle)
      );
    });
  }, [complete, filter, search]);

  const groups = useMemo(() => {
    const movies = filtered.filter((e) => e.kind !== "episode");
    const bySeries = new Map<string, DownloadEntry[]>();
    for (const episode of filtered.filter((e) => e.kind === "episode")) {
      const key = episode.seriesName ?? episode.seriesId ?? "?";
      const bucket = bySeries.get(key);
      if (bucket) bucket.push(episode);
      else bySeries.set(key, [episode]);
    }
    return { movies, series: [...bySeries.entries()].sort((a, b) => a[0].localeCompare(b[0])) };
  }, [filtered]);

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-16 pt-24 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-content-primary">{t("nav:downloads")}</h1>
        <Link
          to="/downloads"
          className="rounded-md bg-fill-subtle px-3 py-1.5 text-xs font-semibold text-content-secondary transition-colors duration-150 hover:bg-fill-soft hover:text-content-primary"
        >
          {t("downloads:offlineManage")}
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("downloads:offlineSearchPlaceholder")}
          className="h-9 w-64 rounded-md border border-line-subtle bg-fill-subtle px-3 text-sm text-content-primary placeholder:text-content-quaternary"
        />
        {(["all", "movies", "series"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
              filter === value
                ? "bg-fill-medium text-content-primary"
                : "bg-fill-subtle text-content-tertiary hover:bg-fill-soft hover:text-content-primary"
            }`}
          >
            {value === "all"
              ? t("downloads:filterAll")
              : value === "movies"
                ? t("downloads:sectionMovies")
                : t("downloads:sectionSeries")}
          </button>
        ))}
      </div>

      {complete.length === 0 ? (
        <div className="mt-20 flex flex-col items-center text-center">
          <p className="text-lg font-semibold text-content-secondary">{t("downloads:offlineEmptyTitle")}</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-content-quaternary">
            {t("downloads:offlineEmptyMessage")}
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {groups.movies.length > 0 && filter !== "series" && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-content-quaternary">
                {t("downloads:sectionMovies")}
              </h2>
              <PosterGrid entries={groups.movies} onSelect={setSelected} />
            </section>
          )}
          {filter !== "movies" &&
            groups.series.map(([seriesName, seriesEntries]) => (
              <section key={seriesName}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-content-quaternary">
                  {seriesName}
                </h2>
                <PosterGrid entries={seriesEntries} onSelect={setSelected} episodeLabels />
              </section>
            ))}
        </div>
      )}

      {selected && <OfflineItemSheet entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function PosterGrid({
  entries,
  onSelect,
  episodeLabels = false,
}: {
  entries: DownloadEntry[];
  onSelect: (entry: DownloadEntry) => void;
  episodeLabels?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {entries.map((entry) => (
        <PosterCard key={entry.id} entry={entry} onSelect={onSelect} episodeLabel={episodeLabels} />
      ))}
    </div>
  );
}

function PosterCard({
  entry,
  onSelect,
  episodeLabel,
}: {
  entry: DownloadEntry;
  onSelect: (entry: DownloadEntry) => void;
  episodeLabel: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const title = entry.title ?? entry.itemId;
  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      className="group text-left transition-transform duration-200 hover:scale-[1.03]"
      title={title}
    >
      <div className="aspect-[2/3] overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line-subtle">
        {!failed ? (
          <img
            src={localResourceUrl(`meta/${entry.itemId}/primary.jpg`)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-content-quaternary">
            {title}
          </div>
        )}
      </div>
      <p className="mt-1.5 truncate text-xs font-medium text-content-secondary group-hover:text-content-primary">
        {title}
      </p>
      {episodeLabel && entry.seasonId && (
        <p className="truncate text-[10px] text-content-quaternary">{entry.seriesName ?? ""}</p>
      )}
    </button>
  );
}
