/**
 * Octave — la tête d'un album, d'une playlist, des titres likés ou d'un
 * artiste : grande image, surtitre, titre, une ligne de métadonnées, puis
 * l'action principale (Lecture) et l'aléatoire.
 */

import type { ReactNode } from "react";
import { Play, Shuffle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { totalDurationParts } from "@tentacle-tv/shared/octave";
import { Artwork } from "./Artwork";

interface CollectionHeaderProps {
  kicker: string;
  title: string;
  artworkUrl?: string | null;
  /** Remplace la pochette (titres likés : un dégradé et un cœur). */
  art?: ReactNode;
  round?: boolean;
  meta: ReactNode;
  canPlay: boolean;
  onPlay: () => void;
  onShuffle: () => void;
  onPress?: () => void;
  extra?: ReactNode;
}

export function CollectionHeader({ kicker, title, artworkUrl = null, art, round = false, meta, canPlay, onPlay, onShuffle, onPress, extra }: CollectionHeaderProps) {
  const { t } = useTranslation("music");
  return (
    <header className="octave-hero px-4 pb-6 pt-8 md:px-8">
      <div className="flex flex-col items-start gap-6 md:flex-row md:items-end">
        {art ?? <Artwork url={artworkUrl} alt={title} round={round} kind={round ? "artist" : "album"} className="h-44 w-44 shadow-2xl md:h-56 md:w-56" eager />}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-content-secondary">{kicker}</p>
          <h1 className="mt-1 break-words text-3xl font-black leading-tight tracking-tight text-content-primary md:text-5xl">{title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-content-secondary">{meta}</div>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          disabled={!canPlay}
          onClick={onPlay}
          onPointerDown={onPress}
          aria-label={t("common.playAll")}
          className="octave-brand-fill flex h-14 w-14 cursor-pointer items-center justify-center rounded-full shadow-lg transition-transform duration-150 hover:scale-105 active:scale-95 disabled:cursor-default disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <Play className="ml-1 h-6 w-6" fill="currentColor" />
        </button>
        <button
          type="button"
          disabled={!canPlay}
          onClick={onShuffle}
          aria-label={t("common.shuffle")}
          title={t("common.shuffle")}
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-content-secondary hover:text-content-primary disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <Shuffle className="h-6 w-6" />
        </button>
        {extra}
      </div>
    </header>
  );
}

/** « 12 titres · 47 min » */
export function useCountAndDuration(count: number, durationMs: number | null): string {
  const { t } = useTranslation("music");
  const parts = [t("count.tracks", { count })];
  if (durationMs && durationMs > 0) {
    const { hours, minutes } = totalDurationParts(durationMs);
    parts.push(hours > 0 ? t("count.hoursMinutes", { hours, minutes }) : t("count.minutes", { minutes }));
  }
  return parts.join(" · ");
}

export function Dot() {
  return <span aria-hidden>·</span>;
}
