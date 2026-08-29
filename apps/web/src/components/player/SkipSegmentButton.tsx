/**
 * LE bouton de saut — intro, résumé, aperçu, générique : une seule pilule,
 * BLANCHE, alignée sur les boutons principaux de l'application (tokens
 * `--cta-primary-*`, mêmes que « Lire » sur une fiche). Elle remplace
 * l'ancienne pilule noire de l'intro et le bouton de générique copié-collé.
 *
 * Le langage ne change pas : même place, même poids. Le décompte n'ajoute que
 * trois choses — le libellé qui compte, une glissière qui court, une croix
 * pour s'y opposer. Annuler ne retire pas le bouton : il redevient manuel.
 *
 * PAS de `backdrop-filter` : la pilule vit au-dessus de la vidéo (que le
 * moteur web ne voit même pas côté mpv), et son fond blanc est opaque —
 * un flou ne flouterait rien et coûterait une couche composée par image.
 * Animations en CSS pur : `scaleX` seul, jamais `width`.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SkipLabelKey } from "@tentacle-tv/shared";

interface SkipSegmentButtonProps {
  /** Clé i18n du libellé (`player:<clé>` et sa forme décomptée `<clé>In`). */
  labelKey: SkipLabelKey;
  /** Secondes restantes avant le saut automatique, `null` = bouton manuel. */
  countdownSeconds: number | null;
  /** Durée totale du décompte — la glissière court sur cette durée. */
  countdownTotalMs: number;
  /** Le saut — clic sur la pilule (le décompte, lui, agit tout seul). */
  onSkip: () => void;
  /** Refuser le saut automatique pour ce passage. */
  onDismiss: () => void;
  /** Couche d'empilement : `z-50` sur le web, `z-20` sur le bureau. */
  layer: string;
}

export function SkipSegmentButton({
  labelKey, countdownSeconds, countdownTotalMs, onSkip, onDismiss, layer,
}: SkipSegmentButtonProps) {
  const { t } = useTranslation("player");
  const armed = countdownSeconds !== null;

  return (
    <div className={`absolute bottom-28 right-6 flex items-center gap-2 ${layer}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSkip(); }}
        className="relative overflow-hidden rounded-full border border-cta-primary-border bg-cta-primary-bg px-6 py-2.5 text-sm font-bold text-cta-primary-fg transition-colors duration-150 hover:bg-cta-primary-bg-hover"
      >
        {armed
          ? t(`player:${labelKey}In`, { seconds: countdownSeconds })
          : t(`player:${labelKey}`)}
        {armed && <Slider durationMs={countdownTotalMs} />}
      </button>
      {armed && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          aria-label={t("player:dismiss")}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/85 transition-colors hover:bg-black/80 hover:text-white"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * Le temps qui reste, montré plutôt que lu. `scaleX` et rien d'autre : animer
 * `width` repeindrait la pilule à chaque image. Sur fond blanc, la glissière
 * est sombre (`bg-black/25`) — le `bg-white/70` d'avant y serait invisible.
 * Sous « animations réduites », elle disparaît, le libellé fait seul le travail.
 */
function Slider({ durationMs }: { durationMs: number }) {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setGone(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <span
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-black/25 transition-transform ease-linear motion-reduce:hidden"
      style={{
        transitionDuration: `${durationMs}ms`,
        transform: `scaleX(${gone ? 1 : 0})`,
      }}
    />
  );
}
