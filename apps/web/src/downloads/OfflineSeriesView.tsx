/**
 * Vue d'une SÉRIE téléchargée : bannière, métadonnées lues dans les snapshots
 * locaux, sélecteur de saison, et les épisodes de la saison choisie.
 *
 * Le sélecteur disparaît quand il n'y a qu'une saison : un choix entre une
 * seule option n'est pas un choix, c'est un clic de plus.
 *
 * Tout vient du disque — la page fonctionne à l'identique en ligne et hors
 * ligne, sans aucune requête serveur.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { DownloadEntry } from "./api";
import { localResourceUrl, useDownloadsRootReady } from "./localFiles";
import { useDownloadsList } from "./useDownloadState";
import { groupOfflineEntries, groupSeasonsBySeries, seasonLabel } from "./offlineGroups";
import { OfflineEpisodeCard } from "./OfflineEpisodeCard";
import { OfflineItemSheet } from "./OfflineItemSheet";
import { SeasonPicker } from "./SeasonPicker";
import { useLocalSnapshot } from "./useLocalSnapshot";
import { RevealCell, RevealScope } from "../components/grid/RevealCell";

/** Vignette 16:9 plus son bloc titre — hauteur réservée avant premier passage. */
const EPISODE_CELL_HEIGHT = 230;

export function OfflineSeriesView() {
  const { t } = useTranslation(["downloads", "common"]);
  const navigate = useNavigate();
  const { seriesKey } = useParams<{ seriesKey: string }>();
  const entries = useDownloadsList();
  const rootReady = useDownloadsRootReady();
  const [selected, setSelected] = useState<DownloadEntry | null>(null);
  const [seasonKey, setSeasonKey] = useState<string | null>(null);
  const [backdropFailed, setBackdropFailed] = useState(false);

  const series = useMemo(() => {
    const complete = entries.filter((e) => e.status === "complete");
    const { seasons } = groupOfflineEntries(complete);
    return groupSeasonsBySeries(seasons).find((s) => s.key === seriesKey) ?? null;
  }, [entries, seriesKey]);

  // La saison choisie peut disparaître (dernier épisode supprimé) : on retombe
  // sur la première plutôt que sur une page vide.
  const season =
    series?.seasons.find((s) => s.key === seasonKey) ?? series?.seasons[0] ?? null;

  const seriesPoster = series?.posterItemId;
  const seasonPoster = season?.posterItemId;
  // La saison porte le synopsis le plus pertinent ; la série prend le relais.
  const seasonSnapshot = useLocalSnapshot(seasonPoster, "season.json", rootReady);
  const seriesSnapshot = useLocalSnapshot(seriesPoster, "series.json", rootReady);

  // Le dernier épisode supprimé fait disparaître la série : ne pas rester sur
  // une page vide.
  useEffect(() => {
    if (entries.length > 0 && !series) navigate("/", { replace: true });
  }, [entries.length, series, navigate]);

  if (!series || !season) {
    // Liste encore vide = chargement en cours : ne pas annoncer une absence
    // qui n'en est pas une (l'effet ci-dessus redirige si elle se confirme).
    return (
      <div className="mx-auto min-h-screen w-full max-w-5xl px-4 pt-24 md:px-8">
        {entries.length > 0 && (
          <p className="text-sm text-content-quaternary">{t("downloads:seriesNotFound")}</p>
        )}
      </div>
    );
  }

  const backdropUrl = rootReady ? localResourceUrl(`meta/${series.posterItemId}/backdrop.jpg`) : null;
  const overview = (seasonSnapshot?.Overview ?? seriesSnapshot?.Overview ?? "").replace(/<[^>]+>/g, "");
  const metaBits = [
    series.seasons.length > 1
      ? t("downloads:seasonsCount", { count: series.seasons.length })
      : seasonLabel(t, season.seasonNumber),
    t("downloads:episodesCount", { count: series.episodeCount }),
    seriesSnapshot?.ProductionYear ? String(seriesSnapshot.ProductionYear) : null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen w-full pb-16">
      <div className="relative">
        {backdropUrl && !backdropFailed && (
          <div className="absolute inset-x-0 top-0 h-72 overflow-hidden">
            <img
              src={backdropUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setBackdropFailed(true)}
            />
            {/* Scrim posé sur image : noir constant dans les deux thèmes. */}
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, var(--surface-1) 100%)" }}
            />
          </div>
        )}

        <div className="relative mx-auto w-full max-w-5xl px-4 pt-24 md:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-md bg-fill-subtle px-3 py-1.5 text-xs font-semibold text-content-secondary transition-colors duration-150 hover:bg-fill-soft hover:text-content-primary"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t("common:back")}
          </Link>

          <h1 className="mt-4 text-3xl font-bold text-content-primary">{series.seriesName}</h1>
          <p className="mt-1 text-sm text-content-tertiary">{metaBits.join(" · ")}</p>
          {overview && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-content-tertiary line-clamp-3">
              {overview}
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto mt-8 w-full max-w-5xl px-4 md:px-8">
        <SeasonPicker seasons={series.seasons} activeKey={season.key} onSelect={setSeasonKey} />

        {/* Une saison entière peut compter plus de cent épisodes, chacun avec sa
            vignette 16:9 (≈ 200 Ko décodés). Les cellules gardent leur place,
            seul leur contenu est démonté hors du champ. */}
        <RevealScope>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {season.episodes.map((episode, i) => (
              <RevealCell key={episode.id} minHeight={EPISODE_CELL_HEIGHT} aspect={16 / 9} textHeight={72} eager={i < 9}>
                <OfflineEpisodeCard
                  entry={episode}
                  onSelect={setSelected}
                  onPlay={(e) => navigate(`/watch/${e.itemId}`)}
                />
              </RevealCell>
            ))}
          </div>
        </RevealScope>
      </div>

      {selected && <OfflineItemSheet entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
