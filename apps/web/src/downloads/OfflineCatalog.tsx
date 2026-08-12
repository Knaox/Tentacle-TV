/**
 * Catalogue local — page d'accueil du mode Hors ligne (desktop).
 *
 * Films en affiches verticales, épisodes regroupés par SÉRIE : une carte
 * « Rick et Morty », qui ouvre la série et laisse choisir la saison. Une série
 * de six saisons occupait sinon six cartes côte à côte — c'est la série qu'on
 * cherche, la saison ne vient qu'après.
 *
 * Images servies depuis le disque. Seuls les téléchargements COMPLETS et
 * lisibles du compte sont montrés.
 */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { correspondALaRecherche } from "@tentacle-tv/shared";
import type { DownloadEntry } from "./api";
import { useDownloadsList } from "./useDownloadState";
import { OfflineItemSheet } from "./OfflineItemSheet";
import { OfflinePosterCard } from "./OfflinePosterCard";
import { RevealCell, RevealScope } from "../components/grid/RevealCell";
import {
  groupOfflineEntries,
  groupSeasonsBySeries,
  groupWatchState,
  seasonLabel,
  seriesGroupMatches,
  watchStateOf,
  type OfflineSeriesGroup,
} from "./offlineGroups";

type Filter = "all" | "movies" | "series";

/**
 * Hauteur réservée à une cellule d'affiche avant son premier passage — affiche
 * 2:3 plus son bloc titre, pour la colonne la plus étroite du catalogue. Elle ne
 * décide que du premier positionnement de la barre de défilement : dès qu'une
 * cellule a été montée, c'est sa hauteur réelle qui est retenue.
 */
const POSTER_CELL_HEIGHT = 260;
/** Bloc titre sous l'affiche — deux lignes plus la marge. */
const POSTER_TEXT_HEIGHT = 48;
/** Cellules montées d'emblée, pour qu'aucune case ne soit vide au premier rendu. */
const EAGER_CELLS = 12;

export function OfflineCatalog() {
  const { t } = useTranslation(["downloads", "nav", "common"]);
  const navigate = useNavigate();
  const entries = useDownloadsList();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DownloadEntry | null>(null);

  const complete = useMemo(() => entries.filter((e) => e.status === "complete"), [entries]);
  const { movies, seasons } = useMemo(() => groupOfflineEntries(complete), [complete]);
  const series = useMemo(() => groupSeasonsBySeries(seasons), [seasons]);

  // Terme brut : c'est le comparateur partagé qui normalise.
  const needle = search.trim();
  const shownMovies = useMemo(
    () => (filter === "series" ? [] : movies.filter((m) => correspondALaRecherche(m.title ?? "", needle))),
    [movies, filter, needle],
  );
  const shownSeries = useMemo(
    () => (filter === "movies" ? [] : series.filter((s) => seriesGroupMatches(s, needle))),
    [series, filter, needle],
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
      ) : shownMovies.length === 0 && shownSeries.length === 0 ? (
        <div className="mt-20 flex flex-col items-center text-center">
          <p className="text-sm font-medium text-content-secondary">{t("common:noResults")}</p>
          <p className="mt-1 text-xs text-content-quaternary">{t("common:noResultsHint")}</p>
        </div>
      ) : (
        // Un seul observateur pour les deux sections : le catalogue local n'est
        // pas borné (il grandit avec le disque), et chaque affiche pèse une
        // image décodée de ~540 Ko. Les cellules gardent leur place, seul leur
        // contenu est démonté hors du champ.
        <RevealScope>
          <div className="mt-8 space-y-10">
            {shownMovies.length > 0 && (
              <Section title={t("downloads:sectionMovies")}>
                {shownMovies.map((movie, i) => (
                  <RevealCell key={movie.id} minHeight={POSTER_CELL_HEIGHT} aspect={2 / 3} textHeight={POSTER_TEXT_HEIGHT} eager={i < EAGER_CELLS}>
                    <MovieCard entry={movie} onOpen={() => setSelected(movie)} />
                  </RevealCell>
                ))}
              </Section>
            )}
            {shownSeries.length > 0 && (
              <Section title={t("downloads:sectionSeries")}>
                {shownSeries.map((group, i) => (
                  <RevealCell key={group.key} minHeight={POSTER_CELL_HEIGHT} aspect={2 / 3} textHeight={POSTER_TEXT_HEIGHT} eager={i < EAGER_CELLS}>
                    <SeriesCard
                      group={group}
                      onOpen={() => navigate(`/offline/series/${encodeURIComponent(group.key)}`)}
                    />
                  </RevealCell>
                ))}
              </Section>
            )}
          </div>
        </RevealScope>
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

function MovieCard({ entry, onOpen }: { entry: DownloadEntry; onOpen: () => void }) {
  const { watched, percent } = watchStateOf(entry);
  return (
    <OfflinePosterCard
      title={entry.title ?? entry.itemId}
      imageCandidates={[`meta/${entry.itemId}/primary.jpg`]}
      watched={watched}
      percent={percent}
      onClick={onOpen}
    />
  );
}

function SeriesCard({ group, onOpen }: { group: OfflineSeriesGroup; onOpen: () => void }) {
  const { t } = useTranslation("downloads");
  // Une seule saison : son numéro est plus parlant que « 1 saison ».
  const label =
    group.seasons.length === 1
      ? seasonLabel(t, group.seasons[0].seasonNumber)
      : t("downloads:seasonsCount", { count: group.seasons.length });
  // Série vue = TOUS ses épisodes téléchargés le sont.
  const { watched } = groupWatchState(group.seasons.flatMap((s) => s.episodes));
  return (
    <OfflinePosterCard
      title={group.seriesName}
      subtitle={`${label} · ${t("downloads:episodesCount", { count: group.episodeCount })}`}
      watched={watched}
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
