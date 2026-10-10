import { useEffect, type CSSProperties } from "react";
import { usePictureInPicture } from "./pictureInPictureContext";
import { PipChrome } from "./PipChrome";
import { pipFrameRadii, pipWheelFactor } from "./pipGeometry";
import { PipLoadingView, useLingeringLoading, type PipLoading } from "./PipLoadingView";
import { PipOverlay } from "./PipOverlay";
import { usePipPointer, type PipCorner } from "./usePipPointer";
import { usePipResizing } from "./usePipResizing";

/**
 * Les contrôles du PiP, rendus par le lecteur DANS la fenêtre PiP (portail).
 *
 * La fenêtre est transparente : la vidéo est la fenêtre de mpv, juste dessous,
 * collée par KWin (ou par la coquille, sur macOS) à l'intérieur du cadre. De l'extérieur vers l'intérieur : la
 * marge de l'ombre (dont les coins sont les poignées de taille), le liseré
 * (`PipChrome`), puis la vidéo et ce qui s'y pose au survol (`PipOverlay`).
 *
 * Flottant, un appui qui bouge sur la vidéo ou le liseré glisse la fenêtre ;
 * ancré, il ne se déplace pas — il est le coin de l'application —, et seul son
 * coin haut-gauche, tourné vers elle, change sa taille. Le double-clic ramène
 * au lecteur, la molette change la taille, Espace met en pause.
 *
 * Pendant le chargement d'une lecture (`loading`), la vue de chargement couvre
 * la vidéo (`PipLoadingView`) ; seuls « revenir au lecteur » et « fermer »
 * restent, au survol. Elle s'efface en fondu quand l'image arrive.
 */

interface PipControlsProps {
  paused: boolean;
  /** Position et durée, en secondes, déjà corrigées du décalage de flux. */
  position: number;
  duration: number;
  title: string;
  onTogglePause: () => void;
  onSkip: (delta: number) => void;
  /** Une lecture se charge : ce qu'elle montre en attendant, sinon `null`. */
  loading?: PipLoading | null;
}

const ALL_CORNERS: readonly PipCorner[] = ["top-left", "top-right", "bottom-left", "bottom-right"];
const DOCKED_CORNERS: readonly PipCorner[] = ["top-left"];

/**
 * Au-delà du cadre, la poignée mord sur l'image : une zone large, facile à
 * attraper (retour de Damien). Sur macOS, le système en tient en plus le bord
 * extérieur (`pip/pipResizeGuard.ts`), où son curseur paraît sans clic.
 */
const GRIP_REACH = 22;

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
  const { paused, onTogglePause, loading = null } = props;
  const waiting = useLingeringLoading(loading);
  const pip = usePictureInPicture();
  const view = pip.container?.ownerDocument.defaultView ?? null;
  const docked = pip.mode === "docked";
  const { hovered, gesture, surface, grip, onControl } = usePipPointer(view, !docked, pip.gesture);
  const visible = hovered || (paused && loading === null) || gesture !== null;
  // Pendant un changement de taille, ni cadre ni contrôles : la vidéo suit
  // le cadre avec une image de retard (`usePipResizing`).
  const resizing = usePipResizing(view);
  const masked = `transition-opacity ${resizing ? "opacity-0 duration-0" : "opacity-100 duration-150"}`;
  const { frame } = pip;
  const radii = pipFrameRadii(frame);

  // Espace met en pause, comme dans le lecteur — dans la fenêtre PiP, et dans
  // l'application : sur macOS, le PiP rend le focus à la fenêtre principale
  // dès qu'on l'a cliqué (`pip/pipWindow.ts`, retour de Damien). Là, seulement
  // quand rien n'y a le focus : Espace y active un bouton, s'écrit dans un champ.
  useEffect(() => {
    if (view === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || loading !== null) return;
      e.preventDefault();
      onTogglePause();
    };
    const onAppKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || loading !== null) return;
      const active = document.activeElement;
      if (active !== null && active !== document.body) return;
      e.preventDefault();
      onTogglePause();
    };
    view.addEventListener("keydown", onKey);
    window.addEventListener("keydown", onAppKey);
    return () => {
      view.removeEventListener("keydown", onKey);
      window.removeEventListener("keydown", onAppKey);
    };
  }, [view, onTogglePause, loading]);

  return (
    <div
      className="absolute inset-0 select-none text-white"
      style={gesture === "move" ? { cursor: "grabbing" } : undefined}
      onWheel={(e) => pip.resizeBy(pipWheelFactor(e.deltaY, e.deltaMode, e.ctrlKey))}
    >
      <div className={`pointer-events-none absolute inset-0 ${masked}`}>
        <PipChrome frame={frame} lit={visible} />
      </div>
      <div
        className="absolute" style={{ inset: frame.shadow }}
        {...surface}
        onDoubleClick={(e) => { if (!onControl(e.target)) pip.expand(); }}
      >
        <div className="absolute overflow-hidden" style={{ inset: frame.bezel, borderRadius: radii.inner }}>
          {waiting.shown !== null && <PipLoadingView loading={waiting.shown} leaving={waiting.leaving} />}
          <div className={`absolute inset-0 ${masked}`}>
            <PipOverlay {...props} visible={visible} loading={loading !== null} />
          </div>
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
