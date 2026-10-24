/**
 * Octave — la barre de lecture, en bas de l'écran : titre en cours à gauche,
 * transport et progression au centre, qualité réelle, état (bibliothèque,
 * prêt, en attente), file et volume à droite. Au téléphone, un MINI-LECTEUR
 * qui ouvre le lecteur plein écran.
 */

import { memo } from "react";
import { ListMusic, Pause, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AvailabilityMark } from "../components/AvailabilityMark";
import { Artwork } from "../components/Artwork";
import { useOctavePlayer, usePlayerPosition, usePlayerSelector } from "../player/OctavePlayerProvider";
import { FormatBadge } from "./FormatBadge";
import { NowPlayingInfo } from "./NowPlayingInfo";
import { SeekBar } from "./SeekBar";
import { Transport } from "./Transport";
import { VolumeControl } from "./VolumeControl";

interface PlayerBarProps {
  queueOpen: boolean;
  onToggleQueue: () => void;
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
      className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${open ? "text-brand" : "text-content-secondary"}`}
    >
      <ListMusic className="h-[18px] w-[18px]" />
    </button>
  );
}

export const PlayerBar = memo(function PlayerBar({ queueOpen, onToggleQueue }: PlayerBarProps) {
  const { t } = useTranslation("music");
  const format = usePlayerSelector((s) => s.format);
  const availability = usePlayerSelector((s) => s.current?.availability ?? null);
  return (
    <section
      aria-label={t("player.region")}
      className="grid h-[84px] grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)] items-center gap-4 border-t border-line-subtle bg-surface-1 px-4"
    >
      <NowPlayingInfo />
      <div className="flex min-w-0 flex-col items-center gap-1">
        <Transport />
        <SeekBar />
      </div>
      <div className="flex min-w-0 items-center justify-end gap-2">
        <div className="hidden min-w-0 items-center gap-2 xl:flex">
          {availability && <AvailabilityMark availability={availability} variant={availability === "library" ? "icon" : "chip"} showLibrary />}
          <FormatBadge format={format} />
        </div>
        <div className="flex min-w-0 xl:hidden">
          <FormatBadge format={format} compact />
        </div>
        <QueueButton open={queueOpen} onToggle={onToggleQueue} />
        <VolumeControl />
      </div>
    </section>
  );
});

/** Le mini-lecteur du téléphone : une ligne, la progression en filet au-dessus. */
export const MiniPlayer = memo(function MiniPlayer({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation("music");
  const player = useOctavePlayer();
  const track = usePlayerSelector((s) => s.current);
  const wantsPlay = usePlayerSelector((s) => s.wantsPlay);
  const { positionMs, durationMs } = usePlayerPosition();
  if (!track) return null;
  const ratio = durationMs ? Math.min(1, positionMs / durationMs) : 0;
  return (
    <div className="relative mx-2 overflow-hidden rounded-xl border border-line-subtle bg-surface-2 shadow-lg">
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-fill-medium">
        <div className="octave-progress-fill h-full bg-content-primary" style={{ transform: `scaleX(${ratio})` }} />
      </div>
      <div className="flex items-center gap-3 p-2">
        <button type="button" onClick={onOpen} aria-label={t("player.open")} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left">
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
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          {wantsPlay ? <Pause className="h-6 w-6" fill="currentColor" /> : <Play className="h-6 w-6" fill="currentColor" />}
        </button>
      </div>
    </div>
  );
});
