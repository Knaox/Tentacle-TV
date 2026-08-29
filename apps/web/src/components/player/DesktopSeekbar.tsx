import type { RefObject } from "react";
import { TrickplayPreview } from "../TrickplayPreview";
import { videoShadow } from "../../lib/videoShadow";
import type { useDesktopSeekbar } from "../../hooks/useDesktopSeekbar";

/**
 * L'ombre de la pastille — la DERNIÈRE du lecteur à ne pas passer par
 * `videoShadow`, et celle qu'on regarde le plus.
 *
 * La classe `shadow` de Tailwind est une ombre FLOUE. Sur la surface à canal
 * alpha de macOS, son dégradé sort quasi opaque au lieu de s'estomper (voir
 * `videoShadow.ts`) : une auréole sombre suivait donc le curseur pendant tout
 * le scrub, à l'endroit exact où l'on regarde.
 *
 * La valeur complète est `boxShadow.DEFAULT` de Tailwind mot pour mot : Windows
 * et le web restent identiques au pixel. Là où la surface a un alpha, rien —
 * une pastille blanche sur la barre rose n'a besoin d'aucun détachement.
 */
const PILL_SHADOW = videoShadow(
  "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  "none",
);

type SeekbarApi = ReturnType<typeof useDesktopSeekbar>;

interface DesktopSeekbarProps {
  seekbar: SeekbarApi;
  displayProgress: number;
  bufProg: number;
}

/**
 * Barre de progression du player desktop : buffer, progression, thumb au
 * survol/drag, vignette trickplay. Extraction mécanique de DesktopPlayer —
 * la logique (scrub/hover/trickplay) vit dans useDesktopSeekbar.
 *
 * Posée sur la vidéo → bg-white/* volontairement en dur dans les deux thèmes.
 */
export function DesktopSeekbar({ seekbar, displayProgress, bufProg }: DesktopSeekbarProps) {
  const {
    seekBarRef, dragProgress,
    hoverTime, hoverX, barWidth, setBarWidth,
    onScrubStart, onBarMouseMove, endHover, trickplay, trickplayFrame,
  } = seekbar;

  return (
    <div ref={seekBarRef as RefObject<HTMLDivElement>}
      className={`group/bar relative mb-3 flex h-1.5 cursor-pointer items-center rounded-full bg-white/20 transition-all ${dragProgress != null ? "h-2.5" : "hover:h-2.5"}`}
      onMouseDown={onScrubStart}
      onMouseMove={onBarMouseMove}
      onMouseEnter={(e) => setBarWidth(e.currentTarget.getBoundingClientRect().width)}
      onMouseLeave={endHover}>
      {/* Buffer bar */}
      <div className="absolute h-full rounded-full bg-white/10" style={{ width: `${bufProg * 100}%` }} />
      {/* Progress bar — rose de la bannière (`--progress-fill`), même couleur
          que la barre des cartes et du lecteur web. */}
      <div className="relative h-full rounded-full" style={{ width: `${displayProgress * 100}%`, background: "var(--progress-fill)" }}>
        <div
          className={`absolute -right-1.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-opacity ${dragProgress != null ? "opacity-100" : "opacity-0 group-hover/bar:opacity-100"}`}
          style={{ boxShadow: PILL_SHADOW }}
        />
      </div>
      <TrickplayPreview
        visible={hoverTime !== null}
        positionSeconds={hoverTime ?? 0}
        frame={trickplayFrame}
        info={trickplay.info}
        anchorX={hoverX}
        parentWidth={barWidth}
      />
    </div>
  );
}
