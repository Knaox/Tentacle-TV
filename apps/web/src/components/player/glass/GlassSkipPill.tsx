import { useTranslation } from "react-i18next";
import type { SkipLabelKey } from "@tentacle-tv/shared";
import { Sweep, Veil } from "../overlayPill";
import { GlassSurface } from "./GlassSurface";
import "./playerGlassOverlays.css";

interface GlassSkipPillProps {
  labelKey: SkipLabelKey;
  countdownSeconds: number | null;
  countdownTotalMs: number;
  onSkip: () => void;
  onDismiss?: () => void;
  layer: string;
  controlsVisible: boolean;
}

/**
 * Le bouton de saut du lecteur en verre — mêmes gestes que `SkipSegmentButton`
 * (le clic saute, la croix refuse, le balayage dit le temps qui reste), autre
 * matière : une capsule de verre au texte blanc, là où l'habillage d'avant
 * posait un aplat blanc opaque.
 *
 * Le voile de survol et le balayage restent ceux d'`overlayPill.tsx` : du NOIR
 * à alpha, la seule teinte translucide qui se compose juste sur la surface à
 * alpha de macOS. Sur le verre, le balayage assombrit donc l'action au fil du
 * décompte — il se lit comme sur la pilule blanche.
 *
 * Le coin bas-droit est partagé avec l'encart « Vous regardez encore ? » et la
 * carte « à suivre » (`.lgp-corner`) : quand la capsule paraît, tout le coin
 * monte au-dessus d'elle, d'une transformée.
 */
export function GlassSkipPill({
  labelKey, countdownSeconds, countdownTotalMs, onSkip, onDismiss, layer, controlsVisible,
}: GlassSkipPillProps) {
  const { t } = useTranslation("player");
  const armed = countdownSeconds !== null;

  return (
    <div className={`lgp-corner ${layer}`} data-lifted={controlsVisible}>
      <GlassSurface className="lgp-pill" group="player-corner">
        <div className="lgp-content lgp-rise lgp-pill__inner">
          <button type="button" onClick={(e) => { e.stopPropagation(); onSkip(); }} className="group/skip lgp-pill__action">
            <Veil className="rounded-l-full group-hover/skip:opacity-100" />
            {armed && <Sweep key={`${labelKey}-${countdownTotalMs}`} durationMs={countdownTotalMs} />}
            <span className="relative">
              {armed ? t(`player:${labelKey}In`, { seconds: countdownSeconds }) : t(`player:${labelKey}`)}
            </span>
          </button>
          {onDismiss && (
            <>
              <span aria-hidden="true" className="lgp-pill__separator" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                aria-label={t("player:dismiss")}
                title={t("player:dismiss")}
                className="group/x lgp-pill__close"
              >
                <Veil className="inset-1 rounded-full group-hover/x:opacity-100" />
                <svg className="relative h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>
      </GlassSurface>
    </div>
  );
}
