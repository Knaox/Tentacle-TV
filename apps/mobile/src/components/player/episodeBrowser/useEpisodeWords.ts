import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { EpisodeEntry, SeasonEntry } from "../../../player/episodes/episodeBrowserModel";

export interface EpisodeWords {
  /** « Épisode 6 », ou rien sans numéro. */
  number: (entry: EpisodeEntry) => string | undefined;
  /** « 12 min », ou « Reste 7 min » d'un épisode entamé. */
  time: (entry: EpisodeEntry) => string | undefined;
  /** Le surtitre : « Épisode 6 · Reste 7 min ». */
  kicker: (entry: EpisodeEntry) => string;
  /** Ce qu'un lecteur d'écran dit d'une ligne. */
  spoken: (entry: EpisodeEntry) => string;
  /** Ce qu'il dit d'une saison : « Saison 3, 12 épisodes, saison en cours ». */
  season: (season: SeasonEntry) => string;
  nowPlaying: string;
}

/** Les mots de la liste des épisodes, les mêmes pour les trois mises en page. */
export function useEpisodeWords(): EpisodeWords {
  const { t } = useTranslation(["player", "common"]);
  return useMemo(() => {
    const number = (entry: EpisodeEntry) =>
      entry.number !== undefined ? t("player:episodeNumber", { number: entry.number }) : undefined;
    const time = (entry: EpisodeEntry) =>
      entry.remainingMinutes !== undefined
        ? t("player:episodeBrowser.remaining", { count: entry.remainingMinutes })
        : entry.minutes !== undefined ? t("common:minutesShort", { count: entry.minutes }) : undefined;
    const kicker = (entry: EpisodeEntry) => [number(entry), time(entry)].filter(Boolean).join(" · ");
    const nowPlaying = t("player:panels.nowPlaying");
    return {
      number,
      time,
      kicker,
      nowPlaying,
      spoken: (entry) => [entry.current ? nowPlaying : null, number(entry), entry.title, time(entry)].filter(Boolean).join(", "),
      season: (season) => [
        season.label,
        season.count ? t("common:seasonTabEpisodes", { count: season.count }) : null,
        season.current ? t("player:episodeBrowser.seasonPlaying") : season.watched ? t("player:episodeBrowser.seasonWatched") : null,
      ].filter(Boolean).join(", "),
    };
  }, [t]);
}
