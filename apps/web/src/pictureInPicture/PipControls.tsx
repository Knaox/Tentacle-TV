import { useEffect, type CSSProperties } from "react";
import { usePictureInPicture } from "./pictureInPictureContext";
import { PipChrome } from "./PipChrome";
import { PIP_WHEEL_STEP, pipFrameRadii } from "./pipGeometry";
import { PipOverlay } from "./PipOverlay";
import { usePipPointer, type PipCorner } from "./usePipPointer";

/**
 * Les contrôles du PiP, rendus par le lecteur DANS la fenêtre PiP (portail).
 *
 * La fenêtre est transparente : la vidéo est la fenêtre de mpv, juste dessous,
 * collée par KWin à l'intérieur du cadre. De l'extérieur vers l'intérieur : la
 * marge de l'ombre (dont les coins sont les poignées de taille), le liseré
 * (`PipChrome`), puis la vidéo et ce qui s'y pose au survol (`PipOverlay`).
 *
 * Flottant, un appui qui bouge sur la vidéo ou le liseré glisse la fenêtre ;
 * ancré, il ne se déplace pas — il est le coin de l'application —, et seul son
 * coin haut-gauche, tourné vers elle, change sa taille. Le double-clic ramène
 * au lecteur, la molette change la taille, Espace met en pause.
 */

interface PipControlsProps {
  paused: boolean;
  /** Position et durée, en secondes, déjà corrigées du décalage de flux. */
  position: number;
  duration: number;
  title: string;
  onTogglePause: () => void;
  onSkip: (delta: number) => void;
}

const ALL_CORNERS: readonly PipCorner[] = ["top-left", "top-right", "bottom-left", "bottom-right"];
const DOCKED_CORNERS: readonly PipCorner[] = ["top-left"];

/** Au-delà du cadre, la poignée mord un peu sur l'image : le coin, arrondi, n'y montre que le liseré. */
const GRIP_REACH = 8;

function gripStyle(corner: PipCorner, size: number): CSSProperties {
  const [vertical, horizontal] = corner.split("-");
  return {
    width: size,
    height: size,
    [vertical === "top" ? "top" : "bottom"]: 0,
    [horizontal === "left" ? "left" : "right"]: 0,
    cursor: corner === "top-left" || corner === "bottom-right" ? "nwse-resize" : "nesw-resize",
  };
}

export function PipControls(props: PipControlsProps) {
  const { paused, onTogglePause } = props;
  const pip = usePictureInPicture();
  const view = pip.container?.ownerDocument.defaultView ?? null;
  const docked = pip.mode === "docked";
  const { hovered, gesture, surface, grip, onControl } = usePipPointer(view, !docked, pip.gesture);
  const visible = hovered || paused || gesture !== null;
  const { frame } = pip;
  const radii = pipFrameRadii(frame);

  // Le clavier de la fenêtre PiP : Espace met en pause, comme dans le lecteur.
  useEffect(() => {
    if (view === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      onTogglePause();
    };
    view.addEventListener("keydown", onKey);
    return () => view.removeEventListener("keydown", onKey);
  }, [view, onTogglePause]);

  return (
    <div
      className="absolute inset-0 select-none text-white"
      style={gesture === "move" ? { cursor: "grabbing" } : undefined}
      onWheel={(e) => pip.resizeBy(e.deltaY < 0 ? PIP_WHEEL_STEP : 1 / PIP_WHEEL_STEP)}
    >
      <PipChrome frame={frame} lit={visible} />
      <div
        className="absolute" style={{ inset: frame.shadow }}
        {...surface}
        onDoubleClick={(e) => { if (!onControl(e.target)) pip.expand(); }}
      >
        <div className="absolute overflow-hidden" style={{ inset: frame.bezel, borderRadius: radii.inner }}>
          <PipOverlay {...props} visible={visible} />
        </div>
      </div>
      {(docked ? DOCKED_CORNERS : ALL_CORNERS).map((corner) => (
        <div
          key={corner} aria-hidden="true" className="absolute"
          style={gripStyle(corner, frame.shadow + frame.bezel + GRIP_REACH)}
          {...grip(corner)}
        />
      ))}
    </div>
  );
}
