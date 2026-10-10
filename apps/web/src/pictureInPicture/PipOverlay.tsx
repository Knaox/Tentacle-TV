import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PauseIcon, PlayIcon } from "../components/PlayerIcons";
import { formatDuration } from "../components/playerControls/utils";
import { usePictureInPicture } from "./pictureInPictureContext";
import { CloseIcon, DockIcon, ExpandIcon, UndockIcon } from "./pipIcons";

/**
 * Ce qui se pose SUR la vidéo du PiP : deux dégradés noirs, les boutons, le
 * titre, le temps — et la progression, un trait au bas de l'image, seul
 * élément visible au repos.
 *
 * La fenêtre est transparente, la vidéo dessous : le noir est la seule couleur
 * que cette surface à alpha compose juste (cf. `DesktopPlayerControls`), d'où
 * des fonds de boutons noirs et des dégradés noirs. Aucun `backdrop-filter` :
 * il recalculerait son flou à chaque image de la vidéo. Seule l'opacité
 * s'anime.
 */

interface PipOverlayProps {
  visible: boolean;
  paused: boolean;
  /** Position et durée, en secondes, déjà corrigées du décalage de flux. */
  position: number;
  duration: number;
  title: string;
  onTogglePause: () => void;
  onSkip: (delta: number) => void;
  /** Une lecture se charge : ni lecture, ni sauts, ni temps — la vue de chargement les remplace. */
  loading?: boolean;
}

function PipButton({ label, onClick, children, variant = "chrome" }: {
  label: string; onClick: () => void; children: ReactNode; variant?: "chrome" | "skip" | "play";
}) {
  const look = {
    chrome: "h-8 w-8 bg-black/45 hover:bg-black/70 active:bg-black/85",
    skip: "h-9 min-w-9 px-2 text-xs font-bold tabular-nums text-white/90 bg-black/45 hover:bg-black/70 active:bg-black/85",
    // Le seul bouton qui grandit au survol — et rien ne bouge sous mouvement réduit.
    play: "h-12 w-12 shadow-[0_2px_10px_rgba(0,0,0,0.45)] transition-transform hover:scale-105 active:scale-95 motion-reduce:transform-none",
  }[variant];
  return (
    <button
      type="button" title={label} aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`flex cursor-pointer items-center justify-center rounded-full text-white outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/80 ${look}`}
      style={variant === "play" ? { background: "var(--progress-fill)" } : undefined}
    >
      {children}
    </button>
  );
}

export function PipOverlay({ visible, paused, position, duration, title, onTogglePause, onSkip, loading = false }: PipOverlayProps) {
  const { t } = useTranslation("player");
  const pip = usePictureInPicture();
  const docked = pip.mode === "docked";
  const progress = duration > 0 ? Math.min(Math.max(position / duration, 0), 1) : 0;
  const fade = `transition-opacity duration-200 ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`;

  return (
    <>
      <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${fade}`}>
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 to-transparent" />
        {!loading && <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/75 to-transparent" />}
      </div>
      {/* Au clavier (Tab), un bouton focalisé garde les contrôles visibles. */}
      <div className={`absolute inset-0 focus-within:pointer-events-auto focus-within:opacity-100 ${fade}`}>
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
        {!loading && <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center gap-4">
          <PipButton variant="skip" label={t("pip.back10")} onClick={() => onSkip(-10)}>-10</PipButton>
          <PipButton variant="play" label={paused ? t("pip.play") : t("pip.pause")} onClick={onTogglePause}>
            {paused ? <PlayIcon /> : <PauseIcon />}
          </PipButton>
          <PipButton variant="skip" label={t("pip.forward30")} onClick={() => onSkip(30)}>+30</PipButton>
        </div>}
        {!loading && <div className="pointer-events-none absolute inset-x-3 bottom-2.5 flex items-baseline gap-2">
          <p className="min-w-0 flex-1 truncate text-xs font-medium text-white/90">{title}</p>
          {duration > 0 && (
            <span className="shrink-0 text-xs tabular-nums text-white/75">
              {formatDuration(position)} / {formatDuration(duration)}
            </span>
          )}
        </div>}
      </div>
      {/* La progression, au bas de l'image, arrondie par les coins de la vidéo. */}
      {!loading && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px]">
        <div className={`absolute inset-0 bg-black/50 ${fade}`} />
        <div
          className="absolute inset-0 origin-left"
          style={{ transform: `scaleX(${String(progress)})`, background: "var(--progress-fill)" }}
        />
      </div>}
    </>
  );
}
