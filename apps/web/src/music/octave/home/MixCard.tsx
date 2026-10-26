/**
 * Octave — la carte d'un MIX de l'accueil : une mosaïque de quatre pochettes
 * (ou une seule), son nom, ses artistes. Un mix n'a pas de page : la carte LIT
 * (les titres sont dans la réponse, aucune attente) ; le mix en cours se
 * reconnaît à sa houle et la carte le met en pause ou le reprend.
 */

import { memo } from "react";
import { Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MusicHomeMix } from "@tentacle-tv/shared/music";
import { Artwork } from "../components/Artwork";
import { CollectionSwell } from "../motion/NowSwell";
import { useOctavePlayer, usePlayerSelector } from "../player/OctavePlayerProvider";
import { mixContextId, mixMosaic, mixSubtitle, mixTitle } from "./homeModel";

function Mosaic({ urls, label }: { urls: readonly string[]; label: string }) {
  if (urls.length < 4) return <Artwork url={urls[0] ?? null} label={label} radius="art" className="h-full w-full shadow-[var(--oc-shadow-art)]" />;
  return (
    // Des carreaux en flex, pas une grille à rangées : le client des téléviseurs LG (Chrome 53) compile ce fichier.
    <div className="flex h-full w-full flex-wrap overflow-hidden rounded-[var(--oc-radius-art)] shadow-[var(--oc-shadow-art)]">
      {urls.map((url) => (
        <Artwork key={url} url={url} label={label} radius="xs" className="h-1/2 w-1/2 rounded-none" />
      ))}
    </div>
  );
}

export const MixCard = memo(function MixCard({ mix }: { mix: MusicHomeMix }) {
  const { t, i18n } = useTranslation("music");
  const player = useOctavePlayer();
  const contextId = mixContextId(mix);
  const current = usePlayerSelector((s) => s.current !== null && s.queue.contextId === contextId);
  const name = mixTitle(mix);
  const subtitle = mixSubtitle(mix, i18n.language);
  const title = name.key === "octaveHome.mixArtist" ? t(name.key, { artist: name.artist }) : t(name.key);
  return (
    <button
      type="button"
      onClick={() => (current ? player.togglePlay() : player.playList(mix.tracks, 0, contextId))}
      aria-label={t("octaveHome.mixPlay", { title })}
      className="octave-card group flex min-w-0 cursor-pointer flex-col gap-2 rounded-[var(--oc-radius-art)] p-2 text-left transition-colors duration-150 hover:bg-octave-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      <div className="relative aspect-square w-full">
        <Mosaic urls={mixMosaic(mix.tracks)} label={title} />
        <CollectionSwell contextId={contextId} />
        <span aria-hidden className="octave-card-play octave-hover-only octave-brand-fill absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full shadow-[var(--oc-shadow-play)]">
          <Play className="ml-0.5 h-5 w-5" fill="currentColor" />
        </span>
      </div>
      <span className="min-w-0 px-0.5">
        <span className="block truncate text-sm font-semibold leading-5 text-content-primary" title={title}>
          {title}
        </span>
        <span className="block truncate text-[13px] leading-5 text-content-tertiary" title={subtitle}>
          {subtitle}
        </span>
      </span>
    </button>
  );
});
