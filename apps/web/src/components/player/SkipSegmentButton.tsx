/**
 * LE bouton de saut — intro, résumé, aperçu, générique, fin : une seule
 * pilule, BLANCHE, alignée sur les boutons principaux de l'application
 * (tokens `--cta-primary-*`, mêmes que « Lire » sur une fiche).
 *
 * # La croix, et pourquoi elle est toujours là
 *
 * Elle n'apparaissait que pendant le décompte : sans décompte, aucun moyen de
 * dire « ne me le propose plus ». Elle est désormais permanente, quel que soit
 * le réglage — et elle appartient à la pilule au lieu de flotter à côté d'elle
 * en noir : un seul objet, un séparateur, deux surfaces également cliquables.
 * Cible ≥ 44 px de haut des deux côtés (l'ancienne croix faisait 32).
 *
 * # Ce qui bouge, et ce qui ne bouge pas
 *
 * Le bouton monte au-dessus de la barre de contrôles quand elle est là, et
 * redescend quand elle s'efface — en `translate`, jamais en `bottom` (animer
 * une position repeint ; animer une transformée compose). Même règle pour
 * l'entrée et la glissière du décompte : `transform` et `opacity`, rien
 * d'autre. Sous « animations réduites », tout se pose sans transition.
 *
 * PAS de `backdrop-filter` : la pilule vit au-dessus de mpv, que le moteur web
 * ne voit même pas, et son fond blanc est opaque — un flou ne flouterait rien
 * et coûterait une couche composée par image. L'ombre passe par
 * `videoShadow()` : macOS et Linux ont un canal alpha, où un flou large sort
 * en aplat noir.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SkipLabelKey } from "@tentacle-tv/shared";
import { videoShadow } from "../../lib/videoShadow";

interface SkipSegmentButtonProps {
  /** Clé i18n du libellé (`player:<clé>` et sa forme décomptée `<clé>In`). */
  labelKey: SkipLabelKey;
  /** Secondes restantes avant le saut automatique, `null` = bouton manuel. */
  countdownSeconds: number | null;
  /** Durée totale du décompte — la glissière court sur cette durée. */
  countdownTotalMs: number;
  /** Le saut — clic sur la pilule (le décompte, lui, agit tout seul). */
  onSkip: () => void;
  /**
   * Ne plus proposer ce passage de la lecture (la croix). ABSENT pour la
   * pilule « épisode suivant » : elle n'apparaît qu'avec les contrôles, elle
   * ne s'impose donc jamais — il n'y a rien à refuser.
   */
  onDismiss?: () => void;
  /** Couche d'empilement : `z-50` sur le web, `z-20` sur le bureau. */
  layer: string;
  /** La barre de contrôles est-elle à l'écran ? La pilule lui cède la place. */
  controlsVisible?: boolean;
}

const PILL_SHADOW = videoShadow(
  "shadow-[0_8px_28px_rgba(0,0,0,0.45)]",
  "ring-1 ring-black/15",
);

export function SkipSegmentButton({
  labelKey, countdownSeconds, countdownTotalMs, onSkip, onDismiss, layer,
  controlsVisible = false,
}: SkipSegmentButtonProps) {
  const { t } = useTranslation("player");
  const armed = countdownSeconds !== null;

  return (
    <div
      className={`absolute bottom-10 right-6 transition-transform duration-300 ease-out motion-reduce:transition-none ${
        controlsVisible ? "-translate-y-16" : "translate-y-0"
      } ${layer}`}
    >
      <Rising>
        <div
          className={`flex items-stretch overflow-hidden rounded-full border border-cta-primary-border bg-cta-primary-bg ${PILL_SHADOW}`}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSkip(); }}
            className="relative min-h-11 px-6 text-sm font-bold text-cta-primary-fg transition-colors duration-150 hover:bg-cta-primary-bg-hover"
          >
            {armed
              ? t(`player:${labelKey}In`, { seconds: countdownSeconds })
              : t(`player:${labelKey}`)}
            {/* La glissière repart à chaque réarmement : la clé porte le
                décompte total ET le libellé, donc tout changement de passage. */}
            {armed && <Slider key={`${labelKey}-${countdownTotalMs}`} durationMs={countdownTotalMs} />}
          </button>

          {onDismiss && (
            <>
              <span aria-hidden="true" className="my-2 w-px bg-cta-primary-fg/20" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                aria-label={t("player:dismiss")}
                title={t("player:dismiss")}
                className="flex min-h-11 w-11 items-center justify-center text-cta-primary-fg/70 transition-colors duration-150 hover:bg-cta-primary-bg-hover hover:text-cta-primary-fg"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>
      </Rising>
    </div>
  );
}

/** L'entrée : la pilule monte et se révèle, en une seule image composée. */
function Rising({ children }: { children: React.ReactNode }) {
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
