import { useMemo } from "react";
import type { TrickplayInfo } from "@tentacle-tv/shared";
import { formatDuration } from "../../playerControls/utils";
import type { TrickplayFrame } from "../../../hooks/useTrickplay";

interface GlassTrickplayBubbleProps {
  visible: boolean;
  positionSeconds: number;
  frame: TrickplayFrame | null;
  info: TrickplayInfo | null;
  anchorX: number;
  parentWidth: number;
}

/** Même largeur d'image que la vignette d'avant (`TrickplayPreview`). */
const DISPLAY_WIDTH = 256;
const TIME_ONLY_WIDTH = 64;
const GAP_TO_SEEKBAR = 18;

/**
 * La vignette du survol de la barre, façon QuickTime et app TV de macOS 26 :
 * l'IMAGE seule — coins arrondis, liseré fin, ombre douce — et le temps en
 * glyphes blancs dessous, sur une pastille d'atténuation. Elle suit le curseur.
 *
 * Plus de bulle de verre autour (lot lg3, « le rendu trickplay est ignoble ») :
 * fenêtre active, le verre clair y faisait un épais cadre gris laiteux, avec le
 * temps dans une bande du même verre. Aucune région native donc : rien à
 * recaler à chaque image, rien à composer derrière — c'était aussi la traînée
 * floue du survol (« flou de mouvement moche ») : la vue native, replacée par IPC
 * une image après la page, glissait derrière la vignette.
 */
export function GlassTrickplayBubble({ visible, positionSeconds, frame, info, anchorX, parentWidth }: GlassTrickplayBubbleProps) {
  const hasFrame = frame !== null && info !== null;
  const scale = hasFrame ? DISPLAY_WIDTH / info.Width : 1;
  const imageHeight = hasFrame ? Math.round(info.Height * scale) : 0;
  const width = hasFrame ? DISPLAY_WIDTH : TIME_ONLY_WIDTH;

  const left = useMemo(
    () => Math.max(0, Math.min(anchorX - width / 2, Math.max(0, parentWidth - width))),
    [anchorX, parentWidth, width],
  );

  return (
    // `translate`, pas `left` : suivre le pointeur ne remet rien en page et reste au
    // compositeur, dans l'image même du déplacement — aucune transition ne porte
    // sur cette propriété (la feuille n'anime que `opacity` et `transform`).
    <div aria-hidden="true" className="lgp-trickplay" data-visible={visible} style={{ translate: `${left}px 0`, bottom: GAP_TO_SEEKBAR, width }}>
      {hasFrame && (
        <div
          className="lgp-trickplay__frame"
          style={{
            height: imageHeight,
            backgroundImage: `url(${frame.url})`,
            backgroundSize: `${Math.round(info.Width * info.TileWidth * scale)}px ${Math.round(info.Height * info.TileHeight * scale)}px`,
            backgroundPosition: `-${Math.round(frame.xInTile * scale)}px -${Math.round(frame.yInTile * scale)}px`,
          }}
        />
      )}
      <span className="lgp-time lgp-trickplay__time">{formatDuration(positionSeconds)}</span>
    </div>
  );
}
