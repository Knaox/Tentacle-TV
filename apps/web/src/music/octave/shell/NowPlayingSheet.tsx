/**
 * Octave — le lecteur plein écran du téléphone (fenêtre étroite) : grande
 * pochette, titre, progression, transport, qualité. Monté seulement ouvert, par un portail ;
 * Échap ou le bouton le referme.
 */

import { memo, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTrackActions } from "../actions/useTrackActions";
import { Artwork } from "../components/Artwork";
import { AvailabilityMark } from "../components/AvailabilityMark";
import { HeartButton } from "../components/HeartButton";
import { usePlayerSelector } from "../player/OctavePlayerProvider";
import { FormatBadge } from "./FormatBadge";
import { SeekBar } from "./SeekBar";
import { Transport } from "./Transport";

export const NowPlayingSheet = memo(function NowPlayingSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("music");
  const track = usePlayerSelector((s) => s.current);
  const format = usePlayerSelector((s) => s.format);
  const actions = useTrackActions();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!track) return null;
  // Un portail : sous un verre ou un `transform`, un `fixed` prendrait son parent pour cadre.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t("player.region")} className="octave-hero octave-sheet fixed inset-0 z-50 flex flex-col bg-surface-0 px-6 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))]">
      <button type="button" onClick={onClose} aria-label={t("player.close")} className="flex h-11 w-11 cursor-pointer items-center justify-center self-start rounded-full text-content-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
        <ChevronDown className="h-6 w-6" />
      </button>
      <div className="flex flex-1 items-center justify-center py-6">
        <Artwork url={track.artworkUrl} alt={track.album?.title ?? track.title} className="aspect-square w-full max-w-sm shadow-2xl" eager />
      </div>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold text-content-primary">{track.title}</p>
          <p className="truncate text-base text-content-secondary">{track.artists.map((a) => a.name).join(", ")}</p>
        </div>
        <HeartButton track={track} actions={actions} size="md" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <AvailabilityMark availability={track.availability} variant="chip" showLibrary />
        <FormatBadge format={format} />
      </div>
      <div className="mt-4">
        <SeekBar />
      </div>
      <div className="mt-4">
        <Transport size="lg" />
      </div>
    </div>,
    document.body,
  );
});
