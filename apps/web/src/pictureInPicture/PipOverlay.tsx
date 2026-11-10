import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PauseIcon, PlayIcon } from "../components/icons/transport";
import { SkipBackGlyph, SkipForwardGlyph } from "../components/player/chrome/skipGlyphs";
import { formatDuration } from "../components/playerControls/utils";
import { useLiquidGlassMode } from "../theme/useLiquidGlass";
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
 *
 * Verre natif (macOS 26) : pas de verre ici — la fenêtre PiP n'a pas de pont
 * natif —, mais la grammaire du lecteur : progression BLANCHE et bouton de
 * lecture noir comme les autres, plus de dégradé de marque (lot lg7, R17/R20).
 * Le document du PiP ne porte pas `data-liquid-glass` : le mode se lit ici.
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

function PipButton({ label, onClick, children, variant = "chrome", plain = false }: {
  label: string; onClick: () => void; children: ReactNode; variant?: "chrome" | "skip" | "play";
  /** Verre natif : le bouton de lecture sans le dégradé de marque. */
  plain?: boolean;
}) {
  // L'encre des capsules du lecteur (refonte de nov. 2026) ; lire / pause est le disque d'ivoire,
  // comme dans l'habillage — plus un aplat rose. La pression répond (97 %), rien ne grossit au survol.
  const ink = "bg-[rgba(24,24,27,0.74)] text-white hover:bg-[#18181B]";
  const look = {
    chrome: `h-8 w-8 ${ink}`,
    skip: `h-10 w-10 ${ink}`,
    play: plain ? `h-12 w-12 ${ink}` : "h-12 w-12 bg-[#F4F2EE] text-[#131315] hover:bg-white",
  }[variant];
  return (
    <button
      type="button" title={label} aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`flex cursor-pointer items-center justify-center rounded-pill outline-none transition-[background-color,transform] duration-hover active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-2 focus-visible:ring-white/80 ${look}`}
    >
      {children}
    </button>
  );
}

/** Le remplissage blanc à 90 % du lecteur en verre (`--lg-player-track-fill`). */
const PLAIN_FILL = "rgb(255 255 255 / 0.9)";

export function PipOverlay({ visible, paused, position, duration, title, onTogglePause, onSkip, loading = false }: PipOverlayProps) {
  const { t } = useTranslation("player");
  const pip = usePictureInPicture();
  const docked = pip.mode === "docked";
  const plain = useLiquidGlassMode() === "native";
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
          <PipButton variant="skip" label={t("pip.back10")} onClick={() => onSkip(-10)}><SkipBackGlyph seconds={10} /></PipButton>
          <PipButton variant="play" plain={plain} label={paused ? t("pip.play") : t("pip.pause")} onClick={onTogglePause}>
            {paused ? <PlayIcon size={24} aria-hidden /> : <PauseIcon size={24} aria-hidden />}
          </PipButton>
          <PipButton variant="skip" label={t("pip.forward30")} onClick={() => onSkip(30)}><SkipForwardGlyph seconds={30} /></PipButton>
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
        <div className={`absolute inset-0 ${plain ? "bg-white/30" : "bg-black/50"} ${fade}`} />
        <div
          className="absolute inset-0 origin-left"
          style={{ transform: `scaleX(${String(progress)})`, background: plain ? PLAIN_FILL : "var(--gauge-gradient)" }}
        />
      </div>}
    </>
  );
}
