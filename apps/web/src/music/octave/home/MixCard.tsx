/**
 * Octave — la carte d'un MIX de l'accueil : une mosaïque de quatre pochettes
 * (ou une seule), son nom, ses artistes. Comme un album : la carte OUVRE la page
 * du mix (`MixView`, consultable : titres, Lecture, Aléatoire), le bouton rond
 * le LIT sans quitter l'accueil (les titres sont dans la réponse, aucune
 * attente) ; le mix en cours se reconnaît à sa houle et le bouton le met en
 * pause ou le reprend. La même règle sur le mobile.
 */

import { memo } from "react";
import { Link } from "react-router-dom";
import { Pause, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import type { MusicHomeMix } from "@tentacle-tv/shared/music";
import { PlaylistArtwork } from "../components/PlaylistArtwork";
import { CollectionSwell } from "../motion/NowSwell";
import { useOctavePlayer, usePlayerSelector } from "../player/OctavePlayerProvider";
import { mixContextId, mixMosaic, mixSubtitle, mixTitle } from "./homeModel";

export const MixCard = memo(function MixCard({ mix }: { mix: MusicHomeMix }) {
  const { t, i18n } = useTranslation("music");
  const player = useOctavePlayer();
  const contextId = mixContextId(mix);
  const current = usePlayerSelector((s) => s.current !== null && s.queue.contextId === contextId);
  const playing = usePlayerSelector((s) => s.current !== null && s.queue.contextId === contextId && s.wantsPlay);
  const name = mixTitle(mix);
  const subtitle = mixSubtitle(mix, i18n.language);
  const title = name.key === "octaveHome.mixArtist" ? t(name.key, { artist: name.artist }) : t(name.key);
  const Icon = playing ? Pause : Play;
  return (
    <Link
      to={octavePaths.homeMix(mix.id)}
      aria-label={t("octaveHome.mixOpen", { title })}
      className="octave-card group flex min-w-0 flex-col gap-2 rounded-[var(--oc-radius-art)] p-2 text-left transition-colors duration-150 hover:bg-octave-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      <div className="relative aspect-square w-full">
        <PlaylistArtwork urls={mixMosaic(mix.tracks)} label={title} radius="art" className="h-full w-full shadow-[var(--oc-shadow-art)]" />
        <CollectionSwell contextId={contextId} />
        <button
          type="button"
          aria-label={t("octaveHome.mixPlay", { title })}
          onPointerEnter={() => mix.tracks[0] && player.prefetch([mix.tracks[0]], "hover")}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (current) player.togglePlay();
            else player.playList(mix.tracks, 0, contextId);
          }}
          className={`octave-card-play octave-brand-fill absolute bottom-2 right-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full shadow-[var(--oc-shadow-play)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus active:scale-95 ${current ? "" : "octave-hover-only"}`}
        >
          <Icon className={playing ? "h-5 w-5" : "ml-0.5 h-5 w-5"} fill="currentColor" />
        </button>
      </div>
      <span className="min-w-0 px-0.5">
        <span className="block truncate text-sm font-semibold leading-5 text-content-primary" title={title}>
          {title}
        </span>
        <span className="block truncate text-[13px] leading-5 text-content-tertiary" title={subtitle}>
          {subtitle}
        </span>
      </span>
    </Link>
  );
});
