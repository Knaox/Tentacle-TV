/**
 * Catalogue local — page d'accueil du mode Hors ligne (desktop).
 * Films en affiches verticales, épisodes REGROUPÉS par saison (une affiche de
 * série par saison, « Rick et Morty · Saison 1 ») ouvrant la vue saison.
 * Images servies depuis le disque par le serveur loopback.
 * Seuls les téléchargements COMPLETS et lisibles du compte sont montrés.
 */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { DownloadEntry } from "./api";
import { useDownloadsList } from "./useDownloadState";
import { OfflineItemSheet } from "./OfflineItemSheet";
import { OfflinePosterCard } from "./OfflinePosterCard";
import { groupOfflineEntries, seasonGroupMatches, type OfflineSeasonGroup } from "./offlineGroups";

type Filter = "all" | "movies" | "series";

export function OfflineCatalog() {
  const { t } = useTranslation(["downloads", "nav", "common"]);
  const navigate = useNavigate();
  const entries = useDownloadsList();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DownloadEntry | null>(null);

  const complete = useMemo(() => entries.filter((e) => e.status === "complete"), [entries]);
  const { movies, seasons } = useMemo(() => groupOfflineEntries(complete), [complete]);

  const needle = search.trim().toLowerCase();
  const shownMovies = useMemo(
    () => (filter === "series" ? [] : movies.filter((m) => (m.title ?? "").toLowerCase().includes(needle))),
    [movies, filter, needle],
  );
  const shownSeasons = useMemo(
    () => (filter === "movies" ? [] : seasons.filter((s) => seasonGroupMatches(s, needle))),
    [seasons, filter, needle],
  );

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
      ) : shownMovies.length === 0 && shownSeasons.length === 0 ? (
        <div className="mt-20 flex flex-col items-center text-center">
          <p className="text-sm font-medium text-content-secondary">{t("common:noResults")}</p>
          <p className="mt-1 text-xs text-content-quaternary">{t("common:noResultsHint")}</p>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {shownMovies.length > 0 && (
            <Section title={t("downloads:sectionMovies")}>
              {shownMovies.map((movie) => (
                <OfflinePosterCard
                  key={movie.id}
                  title={movie.title ?? movie.itemId}
                  imageCandidates={[`meta/${movie.itemId}/primary.jpg`]}
                  onClick={() => setSelected(movie)}
                />
              ))}
            </Section>
          )}
          {shownSeasons.length > 0 && (
            <Section title={t("downloads:sectionSeries")}>
              {shownSeasons.map((group) => (
                <SeasonCard key={group.key} group={group} onOpen={() => navigate(`/offline/season/${encodeURIComponent(group.key)}`)} />
              ))}
            </Section>
          )}
        </div>
      )}

      {selected && <OfflineItemSheet entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-content-quaternary">{title}</h2>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">{children}</div>
    </section>
  );
}

function SeasonCard({ group, onOpen }: { group: OfflineSeasonGroup; onOpen: () => void }) {
  const { t } = useTranslation("downloads");
  const label = group.seasonNumber != null
    ? t("downloads:seasonLabel", { num: group.seasonNumber })
    : t("downloads:seasonUnknown");
  return (
    <OfflinePosterCard
      title={group.seriesName}
      subtitle={label}
      // Affiche verticale de la série ; à défaut (téléchargement hérité non
      // encore réparé), la vignette de l'épisode plutôt que rien.
      imageCandidates={[
        `meta/${group.posterItemId}/series-primary.jpg`,
        `meta/${group.posterItemId}/primary.jpg`,
      ]}
      onClick={onOpen}
    />
  );
}
