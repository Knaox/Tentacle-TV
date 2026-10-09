import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PauseIcon, PlayIcon } from "../components/PlayerIcons";
import { usePictureInPicture } from "./pictureInPictureContext";
import { PIP_WHEEL_STEP } from "./pipGeometry";
import { CloseIcon, DockIcon, ExpandIcon, UndockIcon } from "./pipIcons";

/**
 * Les contrôles du PiP, rendus par le lecteur DANS la fenêtre PiP (portail).
 *
 * La fenêtre est transparente : la vidéo est la fenêtre de mpv, juste dessous,
 * collée par KWin. Rien n'est peint au repos ; au survol, deux dégradés noirs
 * et les boutons — le noir, seule couleur qui se compose juste sur cette
 * surface à alpha (cf. `DesktopPlayerControls`). Aucun `backdrop-filter` : il
 * recalculerait son flou à chaque image de la vidéo.
 *
 * Flottant, toute la fenêtre se glisse (`app-region: drag`, qui marche sous
 * Wayland — banc du 09.10.2026) ; ses boutons non. Ancré, il ne se déplace
 * pas : il est le coin de l'application. La molette change la taille — Electron
 * n'offre aucun bord de redimensionnement à une fenêtre transparente sans cadre.
 */

const DRAG = { WebkitAppRegion: "drag" } as CSSProperties;
const NO_DRAG = { WebkitAppRegion: "no-drag" } as CSSProperties;

interface PipControlsProps {
  paused: boolean;
  /** Position et durée, en secondes, déjà corrigées du décalage de flux. */
  position: number;
  duration: number;
  title: string;
  onTogglePause: () => void;
  onSkip: (delta: number) => void;
}

function PipButton({ label, onClick, children, size = "md" }: {
  label: string; onClick: () => void; children: ReactNode; size?: "sm" | "md" | "lg";
}) {
  const box = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-9 min-w-9 px-2 text-xs font-bold" : "h-8 w-8";
  return (
    <button
      type="button" title={label} aria-label={label} style={NO_DRAG}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`flex ${box} items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-white/20`}
    >
      {children}
    </button>
  );
}

export function PipControls({ paused, position, duration, title, onTogglePause, onSkip }: PipControlsProps) {
  const { t } = useTranslation("player");
  const pip = usePictureInPicture();
  const [hovered, setHovered] = useState(false);
  const docked = pip.mode === "docked";
  const visible = hovered || paused;
  const progress = duration > 0 ? Math.min(Math.max(position / duration, 0), 1) : 0;

  // Le clavier de la fenêtre PiP : Espace met en pause, comme dans le lecteur.
  const view = pip.container?.ownerDocument.defaultView ?? null;
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
      className="absolute inset-0 select-none text-white" style={docked ? undefined : DRAG}
      onMouseEnter={() => setHovered(true)} onMouseMove={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onWheel={(e) => pip.resizeBy(e.deltaY < 0 ? PIP_WHEEL_STEP : 1 / PIP_WHEEL_STEP)}
    >
      <div className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}>
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
      </div>
      <div className={`absolute inset-0 transition-opacity duration-200 ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <div className="absolute left-2 top-2">
          <PipButton label={t("pip.expand")} onClick={pip.expand}><ExpandIcon /></PipButton>
        </div>
        <div className="absolute right-2 top-2 flex gap-1.5">
          <PipButton
            label={docked ? t("pip.undock") : t("pip.dock")}
            onClick={() => pip.setMode(docked ? "floating" : "docked")}
          >
            {docked ? <UndockIcon /> : <DockIcon />}
          </PipButton>
          <PipButton label={t("pip.close")} onClick={pip.close}><CloseIcon /></PipButton>
        </div>
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center gap-3">
          <PipButton size="sm" label={t("pip.back10")} onClick={() => onSkip(-10)}>-10</PipButton>
          <PipButton size="lg" label={paused ? t("pip.play") : t("pip.pause")} onClick={onTogglePause}>
            {paused ? <PlayIcon /> : <PauseIcon />}
          </PipButton>
          <PipButton size="sm" label={t("pip.forward30")} onClick={() => onSkip(30)}>+30</PipButton>
        </div>
        <div className="pointer-events-none absolute inset-x-3 bottom-2.5">
          <p className="truncate text-xs font-medium text-white/90">{title}</p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full" style={{ width: `${String(progress * 100)}%`, background: "var(--progress-fill)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
