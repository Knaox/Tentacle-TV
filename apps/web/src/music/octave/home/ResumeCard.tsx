/**
 * Octave — « Reprendre » en tête de l'accueil : le titre gardé par le lecteur
 * (repris en pause à l'ouverture), là où on s'était arrêté. La carte n'apparaît
 * qu'à l'ARRIVÉE (`resumeShown`) puis reste en place — lecture, pause — : elle
 * ne surgit jamais sous les yeux et ne décale pas la page. Rien n'est demandé
 * au serveur : c'est l'état du lecteur.
 */

import { memo, useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Artwork } from "../components/Artwork";
import { useOctavePlayer, usePlayerPosition, usePlayerSelector } from "../player/OctavePlayerProvider";
import { RESUME_WINDOW_MS, resumeShown } from "./homeModel";

function Progress() {
  const { positionMs, durationMs } = usePlayerPosition();
  const ratio = durationMs && durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0;
  return (
    <span aria-hidden className="block h-1 w-full overflow-hidden rounded-full bg-fill-soft">
      <span className="block h-full w-full origin-left rounded-full bg-octave-accent transition-transform duration-200" style={{ transform: `scaleX(${ratio})` }} />
    </span>
  );
}

export const ResumeCard = memo(function ResumeCard() {
  const { t } = useTranslation("music");
  const player = useOctavePlayer();
  const track = usePlayerSelector((s) => s.current);
  const playing = usePlayerSelector((s) => s.wantsPlay);
  const [inWindow, setInWindow] = useState(true);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setInWindow(false), RESUME_WINDOW_MS);
    return () => clearTimeout(timer);
  }, []);
  const visible = resumeShown(shown, inWindow, track, playing);
  // Retenu au rendu même : la carte posée ne repart plus (React admet ce réglage de son propre état).
  if (visible !== shown) setShown(visible);
  if (!visible || !track) return null;
  const Icon = playing ? Pause : Play;
  return (
    <section aria-label={t("octaveHome.resume")} className="px-2">
      <button
        type="button"
        onClick={() => player.togglePlay()}
        aria-label={playing ? t("player.pause") : t("octaveHome.resumePlay", { title: track.title })}
        className="group flex w-full max-w-xl cursor-pointer items-center gap-4 rounded-[var(--oc-radius-art-lg)] p-2 pr-4 text-left transition-colors duration-150 hover:bg-octave-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        <Artwork url={track.artworkUrl} label={track.album?.title ?? track.title} radius="art" eager className="h-20 w-20 shrink-0 shadow-[var(--oc-shadow-art)]" />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="oc-eyebrow">{t("octaveHome.resume")}</span>
          <span className="truncate text-base font-semibold text-content-primary">{track.title}</span>
          <span className="truncate text-sm text-content-tertiary">{track.artists.map((a) => a.name).join(", ")}</span>
          <Progress />
        </span>
        <span aria-hidden className="octave-brand-fill flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-[var(--oc-shadow-play)] transition-transform duration-150 group-active:scale-95">
          <Icon className={`h-5 w-5 ${playing ? "" : "ml-0.5"}`} fill="currentColor" />
        </span>
      </button>
    </section>
  );
});
