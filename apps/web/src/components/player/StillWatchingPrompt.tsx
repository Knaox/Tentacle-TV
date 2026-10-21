/**
 * « Vous regardez encore ? » — l'encart du lecteur web, du lecteur de bureau
 * et du miroir. Aucune décision ici : la phase, le décompte et les gestes
 * viennent du contrôleur partagé (`useStillWatching`, api-client).
 *
 * # Où il se pose
 *
 * Dans le coin bas-droit, à la place EXACTE de la pilule « Passer l'intro »
 * (`SkipSegmentButton`) : il monte au-dessus de la barre de contrôles quand
 * elle paraît, en `translate` — il ne la cache jamais. Pendant qu'il est là, la
 * pilule et la carte « à suivre » s'effacent (`overlayBesideStillWatching`).
 *
 * # Sa matière
 *
 * Une carte sombre PRESQUE OPAQUE, sans `backdrop-filter` : sur le bureau, mpv
 * dessine hors du moteur web, qui ne verrait rien à flouter ; sur le web, un
 * fond à 0,96 d'alpha ne laisse rien voir de flou. Le flou ne coûterait qu'une
 * recopie de la vidéo à chaque image. Le décompte est une barre en dégradé de
 * marque qui se vide en `scaleX`, armée UNE fois — jamais une largeur animée.
 *
 * # Ce qu'il ne fait pas
 *
 * Il ne prend pas le focus (on regarde un film : il n'interrompt rien au
 * clavier). Il arrête la propagation de ses gestes : un clic dessus ne met pas
 * le lecteur en pause par-dessous, et — surtout — les écouteurs d'activité ne
 * transforment pas un clic sur « Mettre en pause » en « Continuer »
 * (`useStillWatchingActivity` les ignore aussi, par `data-still-watching`).
 */

import { useEffect, useId, useState, type HTMLAttributes, type ReactNode, type SyntheticEvent, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Hourglass, Pause } from "lucide-react";
import type { StillWatchingController } from "@tentacle-tv/api-client";
import { videoShadow } from "../../lib/videoShadow";
import { usePlayerGlassMode } from "./glass/PlayerGlassContext";
import { isGlassLayout } from "./glass/playerGlassMode";
import { GlassSurface } from "./glass/GlassSurface";
import "./glass/playerGlassOverlays.css";

export type StillWatchingSurface = "web" | "desktop" | "mirror";

interface StillWatchingPromptProps {
  controller: StillWatchingController;
  /** La barre de contrôles est à l'écran : l'encart monte au-dessus (web, bureau). */
  controlsVisible: boolean;
  /** `web` : couche `z-50` ; `desktop` : `z-20` (au-dessus de mpv, comme la pilule) ; `mirror` : la place du miroir. */
  surface?: StillWatchingSurface;
}

/** Un bouton de l'encart — la règle de ce qui s'affiche, testée seule. */
export interface StillWatchingAction {
  id: "continue" | "pause" | "resume";
  labelKey: string;
  primary: boolean;
  run: () => void;
}

export function stillWatchingActions(controller: StillWatchingController): StillWatchingAction[] {
  if (controller.phase === "asking") {
    return [
      { id: "continue", labelKey: "player:stillWatching.continue", primary: true, run: controller.keepWatching },
      { id: "pause", labelKey: "player:stillWatching.pause", primary: false, run: controller.pauseNow },
    ];
  }
  if (controller.phase === "paused") {
    return [{ id: "resume", labelKey: "player:stillWatching.resume", primary: true, run: controller.resume }];
  }
  return [];
}

/** Secondes affichées : arrondies au-dessus, jamais « 0 seconde » tant que la question est posée. */
export function countdownSeconds(remainingMs: number): number {
  return Math.max(1, Math.ceil(remainingMs / 1000));
}

const CARD_SHADOW = videoShadow("shadow-[0_12px_40px_rgba(0,0,0,0.5)]", "ring-1 ring-black/20");

/**
 * Les deux habillages de l'encart. Le verre (lecteur de bureau, `glass/`) n'a
 * que des couleurs PLEINES ou du noir à alpha : un blanc translucide posé sur
 * la surface à alpha de macOS rendrait gris (`playerGlass.css`).
 */
const LOOK = {
  legacy: {
    card: `w-[min(340px,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-white/10 bg-[rgba(16,14,24,0.96)] p-5 text-white ${CARD_SHADOW}`,
    icon: "bg-[rgba(var(--brand-rgb),0.18)] text-[var(--brand-light)]",
    body: "text-white/70",
    track: "bg-white/10",
    secondary: "border border-white/15 font-medium text-white/85",
    ring: "focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#100e18]",
    secondaryVeil: "bg-white/[0.12]",
  },
  glass: {
    card: "lgp-card w-[min(340px,calc(100vw-3rem))] p-5",
    icon: "lgp-card__icon",
    body: "lgp-card__body",
    track: "lgp-card__track",
    secondary: "lgp-card__secondary font-medium",
    ring: "focus-visible:ring-[var(--lg-player-focus)]",
    secondaryVeil: "bg-black/15",
  },
} as const;
type Look = (typeof LOOK)[keyof typeof LOOK];

const stop = (event: SyntheticEvent) => event.stopPropagation();
/** Échap garde son office (quitter le plein écran, le lecteur) ; le reste ne traverse pas. */
const stopKeys = (event: KeyboardEvent) => {
  if (event.key !== "Escape") event.stopPropagation();
};

export function StillWatchingPrompt({ controller, controlsVisible, surface = "web" }: StillWatchingPromptProps) {
  const { t } = useTranslation("player");
  const titleId = useId();
  const bodyId = useId();
  const { phase } = controller;
  // Lecteur en verre (bureau seulement) : la carte devient un verre, au coin
  // partagé avec la pilule (`.lgp-corner`) ; gestes et textes inchangés.
  const glass = isGlassLayout(usePlayerGlassMode()) && surface === "desktop";
  const look: Look = glass ? LOOK.glass : LOOK.legacy;
  if (phase === "none") return null;

  const asking = phase === "asking";
  const actions = stillWatchingActions(controller);
  const mirror = surface === "mirror";
  const layer = surface === "desktop" ? "z-20" : "z-50";

  return (
    <div
      className={glass ? `lgp-corner ${layer}` : mirror ? "absolute" : `absolute bottom-10 right-6 transition-transform duration-300 ease-out motion-reduce:transition-none ${
        controlsVisible ? "-translate-y-16" : "translate-y-0"
      } ${layer}`}
      data-lifted={glass ? controlsVisible : undefined}
      // Le miroir loge sa pilule au-dessus de son habillage tactile, encoches comprises (`SkipButton`).
      style={mirror ? {
        zIndex: 60,
        bottom: "max(110px, calc(env(safe-area-inset-bottom, 0px) + 86px))",
        right: "max(20px, calc(env(safe-area-inset-right, 0px) + 16px))",
      } : undefined}
    >
      <Entering>
        <Card
          glass={glass}
          data-still-watching=""
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          aria-live="polite"
          onPointerDown={stop}
          onTouchStart={stop}
          onClick={stop}
          onDoubleClick={stop}
          onKeyDown={stopKeys}
          className={look.card}
        >
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${look.icon}`}>
              {asking ? <Hourglass size={18} strokeWidth={2.2} /> : <Pause size={18} strokeWidth={2.2} />}
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-base font-semibold leading-snug">
                {asking ? t("player:stillWatching.title") : t("player:stillWatching.pausedTitle")}
              </h2>
              {/* Le décompte change chaque seconde : il ne se relit pas à voix haute à chaque fois. */}
              <p id={bodyId} aria-live="off" className={`mt-1 text-sm leading-relaxed ${look.body}`}>
                {asking
                  ? t("player:stillWatching.countdown", { count: countdownSeconds(controller.remainingMs) })
                  : t("player:stillWatching.pausedBody")}
              </p>
            </div>
          </div>

          {asking && <CountdownBar remainingMs={controller.remainingMs} totalMs={controller.countdownMs} trackClass={look.track} />}

          <div className={`flex gap-2 ${asking ? "mt-4" : "mt-5"}`}>
            {actions.map((action) => (
              <PromptButton key={action.id} primary={action.primary} onPress={action.run} look={look}>
                {t(action.labelKey)}
              </PromptButton>
            ))}
          </div>
        </Card>
      </Entering>
    </div>
  );
}

/** La carte : un verre dans le lecteur en verre, la carte d'avant ailleurs — mêmes attributs. */
function Card({ glass, children, ...props }: HTMLAttributes<HTMLDivElement> & { glass: boolean; "data-still-watching": string }) {
  return glass ? <GlassSurface {...props}>{children}</GlassSurface> : <div {...props}>{children}</div>;
}

function PromptButton({ primary, onPress, look, children }: { primary: boolean; onPress: () => void; look: Look; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={(event) => { event.stopPropagation(); onPress(); }}
      className={`group/sw relative flex min-h-11 flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-full px-4 text-sm outline-none focus-visible:ring-2 ${look.ring} ${
        primary
          ? "bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)] font-semibold text-white"
          : look.secondary
      }`}
    >
      {/* Le survol en OPACITÉ d'un voile, jamais une couleur de fond animée (repeinte à chaque image).
          Sur le dégradé (opaque), un voile blanc se compose juste ; sur le verre, seul le noir. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${primary ? "bg-white/[0.12]" : look.secondaryVeil} opacity-0 transition-opacity duration-150 group-hover/sw:opacity-100 motion-reduce:transition-none`}
      />
      <span className="relative">{children}</span>
    </button>
  );
}

/**
 * La barre du décompte : UNE transition linéaire, armée au montage, de la part
 * restante jusqu'à zéro — pas une transformée recalculée à chaque battement
 * (cf. l'avertissement de `Sweep`, `overlayPill.tsx`). Sous « animations
 * réduites », elle s'efface : la phrase décompte en toutes lettres.
 */
function CountdownBar({ remainingMs, totalMs, trackClass }: { remainingMs: number; totalMs: number; trackClass: string }) {
  const [armed] = useState(() => ({
    fraction: totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0,
    durationMs: Math.max(0, remainingMs),
  }));
  const [running, setRunning] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRunning(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div aria-hidden="true" className={`mt-4 h-1 overflow-hidden rounded-full ${trackClass} motion-reduce:hidden`}>
      <div
        className="h-full origin-left rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)] transition-transform ease-linear"
        style={{ transitionDuration: `${String(armed.durationMs)}ms`, transform: `scaleX(${running ? 0 : armed.fraction})` }}
      />
    </div>
  );
}

/** L'entrée : fondu et montée de 8 px, 200 ms, en une seule image composée. */
function Entering({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      className={`origin-bottom-right transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}
