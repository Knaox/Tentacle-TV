/**
 * Vue d'une SAISON téléchargée : bannière de série, métadonnées lues dans les
 * snapshots locaux (`season.json`, repli `series.json`) et liste des épisodes
 * en vignettes 16:9, triés par numéro.
 *
 * Tout vient du disque via le serveur loopback — la page fonctionne à
 * l'identique en ligne et hors ligne, sans aucune requête serveur.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { DownloadEntry } from "./api";
import { localResourceUrl, useDownloadsRootReady } from "./localFiles";
import { useDownloadsList } from "./useDownloadState";
import { groupOfflineEntries } from "./offlineGroups";
import { OfflineEpisodeCard } from "./OfflineEpisodeCard";
import { OfflineItemSheet } from "./OfflineItemSheet";
import { useLocalSnapshot } from "./useLocalSnapshot";

export function OfflineSeasonView() {
  const { t } = useTranslation(["downloads", "common"]);
  const navigate = useNavigate();
  const { groupKey } = useParams<{ groupKey: string }>();
  const entries = useDownloadsList();
  const rootReady = useDownloadsRootReady();
  const [selected, setSelected] = useState<DownloadEntry | null>(null);
  const [backdropFailed, setBackdropFailed] = useState(false);

  const group = useMemo(() => {
    const complete = entries.filter((e) => e.status === "complete");
    return groupOfflineEntries(complete).seasons.find((s) => s.key === groupKey) ?? null;
  }, [entries, groupKey]);

  const posterItemId = group?.posterItemId;
  // La saison porte le synopsis le plus pertinent ; la série prend le relais.
  const season = useLocalSnapshot(posterItemId, "season.json", rootReady);
  const series = useLocalSnapshot(posterItemId, "series.json", rootReady);

  // Le dernier épisode supprimé fait disparaître la saison : ne pas rester sur
  // une page vide.
  useEffect(() => {
    if (entries.length > 0 && !group) navigate("/", { replace: true });
  }, [entries.length, group, navigate]);

  if (!group) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-5xl px-4 pt-24 md:px-8">
        <p className="text-sm text-content-quaternary">{t("downloads:seasonNotFound")}</p>
      </div>
    );
  }

  const backdropUrl = rootReady ? localResourceUrl(`meta/${group.posterItemId}/backdrop.jpg`) : null;
  const seasonLabel = group.seasonNumber != null
    ? t("downloads:seasonLabel", { num: group.seasonNumber })
    : t("downloads:seasonUnknown");
  const overview = (season?.Overview ?? series?.Overview ?? "").replace(/<[^>]+>/g, "");
  const metaBits = [
    seasonLabel,
    t("downloads:episodesCount", { count: group.episodes.length }),
    series?.ProductionYear ? String(series.ProductionYear) : null,
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

          <h1 className="mt-4 text-3xl font-bold text-content-primary">{group.seriesName}</h1>
          <p className="mt-1 text-sm text-content-tertiary">{metaBits.join(" · ")}</p>
          {overview && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-content-tertiary line-clamp-3">
              {overview}
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto mt-8 w-full max-w-5xl px-4 md:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {group.episodes.map((episode) => (
            <OfflineEpisodeCard
              key={episode.id}
              entry={episode}
              onSelect={setSelected}
              onPlay={(e) => navigate(`/watch/${e.itemId}`)}
            />
          ))}
        </div>
      </div>

      {selected && <OfflineItemSheet entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
