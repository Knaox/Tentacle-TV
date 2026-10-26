/**
 * Octave — le lecteur « en cours » : grande pochette, surtitre rose, titre,
 * artistes, qualité, progression, transport (et volume, fenêtre large). Ouvert
 * par la pochette du dock (bureau) ou le mini-lecteur (téléphone) ; deux
 * colonnes en fenêtre large, une pile au téléphone.
 *
 * Monté seulement ouvert, par un portail ; il monte du dock (entrée finie,
 * `octave-stage-in`), Échap ou ⌄ le referme et le focus revient d'où il venait.
 * Un fond d'encre opaque et un voile fixe : aucun flou.
 */

import { memo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTrackActions } from "../actions/useTrackActions";
import { Artwork } from "../components/Artwork";
import { AvailabilityMark } from "../components/AvailabilityMark";
import { HeartButton } from "../components/HeartButton";
import { TrackMenu } from "../components/TrackMenu";
import { AlbumLink, ArtistLinks } from "../components/TrackLinks";
import { QuickAddButton } from "../components/QuickAddButton";
import { usePlayerSelector } from "../player/OctavePlayerProvider";
import { FormatBadge } from "./FormatBadge";
import { SeekBar } from "./SeekBar";
import { Transport } from "./Transport";
import { VolumeControl } from "./VolumeControl";
import { OceanAmbience } from "../motion/OceanAmbience";

/** Échap referme ; le focus entre sur ⌄ et revient, à la fermeture, là où il était. */
function useDialogFocus(onClose: () => void) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [onClose]);
  return close;
}

export const NowPlayingSheet = memo(function NowPlayingSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("music");
  const track = usePlayerSelector((s) => s.current);
  const format = usePlayerSelector((s) => s.format);
  const actions = useTrackActions();
  const close = useDialogFocus(onClose);
  if (!track) return null;
  // Un portail : sous un verre ou un `transform`, un `fixed` prendrait son parent pour cadre.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("shell.nowPlaying")}
      data-octave-now-playing-view
      className="octave-stage-in fixed inset-0 z-50 flex flex-col overflow-y-auto bg-octave-ink px-6 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] md:px-12"
      style={{ paddingTop: "calc(var(--hote-bandeau, 0px) + 1rem + env(safe-area-inset-top, 0px))" }}
    >
      <div aria-hidden className="octave-now-veil" />
      <OceanAmbience artworkUrl={track.artworkUrl} />
      <div className="relative flex items-center justify-between">
        <button
          ref={close}
          type="button"
          onClick={onClose}
          aria-label={t("player.close")}
          title={t("player.close")}
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-content-secondary transition-colors duration-150 hover:bg-octave-hover hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <ChevronDown className="h-6 w-6" aria-hidden />
        </button>
        <p className="oc-eyebrow">{t("shell.nowPlaying")}</p>
        <span className="h-11 w-11" aria-hidden />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-6 py-6 md:flex-row md:items-center md:gap-14">
        <div className="octave-now-art flex justify-center md:w-[46%] md:shrink-0">
          <Artwork
            url={track.artworkUrl}
            alt={track.album?.title ?? track.title}
            className="aspect-square w-full max-w-sm shadow-[var(--oc-shadow-art-lg)] md:max-w-[520px]"
            eager
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {track.album && (
                <p className="truncate text-sm text-content-tertiary">
                  <AlbumLink track={track} onNavigate={onClose} />
                </p>
              )}
              <h2 className="oc-display mt-1 break-words text-3xl text-content-primary md:text-5xl">{track.title}</h2>
              <p className="mt-2 truncate text-base text-content-secondary md:text-lg">
                <ArtistLinks track={track} onNavigate={onClose} />
              </p>
            </div>
            <HeartButton track={track} actions={actions} size="md" />
            <QuickAddButton track={track} actions={actions} visible="always" className="h-11 w-11 text-content-secondary" />
            <TrackMenu track={track} actions={actions} visible="always" buttonClassName="h-11 w-11 text-content-secondary" onNavigate={onClose} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AvailabilityMark availability={track.availability} variant="chip" showLibrary />
            <FormatBadge format={format} />
          </div>
          <SeekBar />
          <Transport size="lg" />
          <div className="hidden justify-center md:flex">
            <VolumeControl className="w-40" />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
});
