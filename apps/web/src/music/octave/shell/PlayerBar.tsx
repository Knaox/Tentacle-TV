/**
 * Octave — la barre de lecture, le « dock » : une capsule de verre sombre qui
 * FLOTTE au-dessus des pages (la famille de la barre de navigation de
 * Tentacle), la page défilant dessous. Titre en cours à gauche (sa pochette
 * ouvre le lecteur « en cours »), transport et progression au centre, qualité
 * réelle (et, lu depuis la copie gardée, « Sur cet appareil »), état, transition douce (`CrossfadeButton`),
 * « Arrêter la lecture » (`StopButton`), file et volume ROSE à droite. Au téléphone, un MINI-LECTEUR,
 * la même capsule en une ligne.
 *
 * TOUJOURS SOMBRE, dans les deux thèmes (« jamais une barre blanche ») : la
 * nuit d'Octave (`octave-night`, octaveNight.css). Liquid Glass (mode natif) :
 * le verre de la maquette (`material: "pane"` du socle), son ton FORCÉ à
 * `dark` — matériau et glyphes sombres quel que soit le dessous, une encre plus
 * dense (`shellGlass.css`). Ailleurs : le verre sombre de `shell.css`
 * (`octave-dock-fallback`).
 *
 * La qualité n'est jamais coupée au milieu d'un mot : en mot quand SA colonne
 * a la place (requête de conteneur, `shell.css`), en icône seule (nom
 * accessible, infobulle) plus à l'étroit, sinon elle s'efface — le détail
 * reste dans le lecteur « en cours ».
 */

import { memo } from "react";
import { ListMusic, Pause, Play, SkipForward } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLiquidGlassSurface } from "../../../theme/glass";
import { AvailabilityMark } from "../components/AvailabilityMark";
import { Artwork } from "../components/Artwork";
import { FromDeviceMark } from "../offline/FromDeviceMark";
import { useOctavePlayer, usePlayerPosition, usePlayerSelector } from "../player/OctavePlayerProvider";
import { CrossfadeButton } from "./crossfade/CrossfadeButton";
import { FormatBadge } from "./FormatBadge";
import { NowPlayingInfo } from "./NowPlayingInfo";
import { SeekBar } from "./SeekBar";
import { StopButton } from "./StopButton";
import { Transport } from "./Transport";
import { VolumeControl } from "./VolumeControl";

interface PlayerBarProps {
  queueOpen: boolean;
  onToggleQueue: () => void;
  onOpenNowPlaying: () => void;
}

function QueueButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { t } = useTranslation("music");
  return (
    <button
      type="button"
      aria-pressed={open}
      aria-label={t("player.queue")}
      title={t("player.queue")}
      onClick={onToggle}
      className={`octave-dock-chip lg-bead relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${open ? "text-octave-accent-text" : "text-content-secondary hover:text-content-primary"}`}
    >
      <ListMusic className="h-[18px] w-[18px]" aria-hidden />
      {open && <span aria-hidden className="absolute bottom-0.5 h-1 w-1 rounded-full bg-octave-accent" />}
    </button>
  );
}

export const PlayerBar = memo(function PlayerBar({ queueOpen, onToggleQueue, onOpenNowPlaying }: PlayerBarProps) {
  const { t } = useTranslation("music");
  const format = usePlayerSelector((s) => s.format);
  const availability = usePlayerSelector((s) => s.current?.availability ?? null);
  // Le verre de la maquette, ton sombre forcé ; son rayon (32) vient de `glass/octaveDock.css`.
  const glass = useLiquidGlassSurface({
    material: "pane",
    tone: "dark",
    shape: "rounded",
    className:
      "octave-night pointer-events-auto mx-auto grid h-[var(--oc-dock-height)] w-full max-w-[var(--oc-dock-max)] grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1fr)] items-center gap-4 px-3",
    fallbackClassName: "octave-dock-fallback",
  });
  return (
    // La zone ne prend pas les clics : la page reste cliquable autour du dock.
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-[var(--oc-dock-inset)] pb-[var(--oc-dock-inset)]">
      <section aria-label={t("player.region")} data-octave-dock {...glass.props}>
        {glass.layers}
        <NowPlayingInfo artworkClass="h-[52px] w-[52px]" onOpen={onOpenNowPlaying} />
        <div className="flex min-w-0 flex-col items-center">
          <Transport />
          <SeekBar />
        </div>
        <div className="octave-dock-aside flex min-w-0 items-center justify-end gap-1.5">
          <div className="octave-dock-meta shrink-0 items-center gap-2 whitespace-nowrap">
            {availability && (
              <span className="octave-dock-availability">
                <AvailabilityMark availability={availability} variant="icon" showLibrary />
              </span>
            )}
            {/* D'où il lit : la copie gardée sur cet appareil (rien en flux). */}
            <FromDeviceMark variant="icon" />
            <span className="octave-dock-quality-label">
              <FormatBadge format={format} compact />
            </span>
            <span className="octave-dock-quality-icon">
              <FormatBadge format={format} icon />
            </span>
          </div>
          <CrossfadeButton />
          <StopButton shape="stop" className="octave-dock-chip lg-bead h-9 w-9 text-content-secondary hover:text-content-primary" />
          <QueueButton open={queueOpen} onToggle={onToggleQueue} />
          <VolumeControl className="octave-dock-volume" />
        </div>
      </section>
    </div>
  );
});

/** Le mini-lecteur du téléphone : la capsule du dock en une ligne (lecture, titre suivant, arrêter), la progression en filet dessous. */
export const MiniPlayer = memo(function MiniPlayer({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation("music");
  const player = useOctavePlayer();
  const track = usePlayerSelector((s) => s.current);
  const wantsPlay = usePlayerSelector((s) => s.wantsPlay);
  const { positionMs, durationMs } = usePlayerPosition();
  const glass = useLiquidGlassSurface({
    material: "pane",
    tone: "dark",
    shape: "rounded",
    radius: "lg",
    className: "octave-night relative overflow-hidden",
    fallbackClassName: "octave-dock-fallback",
  });
  if (!track) return null;
  const ratio = durationMs ? Math.min(1, positionMs / durationMs) : 0;
  return (
    <div {...glass.props}>
      {glass.layers}
      <div className="flex items-center gap-3 p-2">
        <button type="button" onClick={onOpen} aria-label={t("player.open")} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
          <Artwork url={track.artworkUrl} className="h-10 w-10" eager />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-content-primary">{track.title}</span>
            <span className="block truncate text-xs text-content-tertiary">{track.artists.map((a) => a.name).join(", ")}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => player.togglePlay()}
          aria-label={t(wantsPlay ? "player.pause" : "player.play")}
          className="octave-play flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          {wantsPlay ? <Pause className="relative h-5 w-5" fill="currentColor" aria-hidden /> : <Play className="relative ml-0.5 h-5 w-5" fill="currentColor" aria-hidden />}
        </button>
        <button
          type="button"
          onClick={() => player.next()}
          aria-label={t("player.next")}
          className="octave-touch flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-content-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <SkipForward className="h-5 w-5" fill="currentColor" aria-hidden />
        </button>
        <StopButton shape="close" className="octave-touch h-11 w-11 text-content-tertiary" />
      </div>
      <div aria-hidden className="octave-mini-progress">
        <div className="octave-range-fill" data-fill="progress" style={{ transform: `scaleX(${ratio})` }} />
      </div>
    </div>
  );
});
