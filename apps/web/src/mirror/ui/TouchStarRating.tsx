import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { STAR_PATH, STAR_VIEWBOX } from "@tentacle-tv/shared";
import { RatingBurst } from "../../components/rating/RatingBurst";

/** Côté d'une étoile et écart entre deux (`StarRatingMobile` de l'app, feuille : 34). */
const SIZE = 34;
const GAP = 6;
/** Débord vertical des zones de toucher : 34 + 2 × 5 = 44 px de haut. */
const REACH = 5;

interface TouchStarRatingProps {
  /** Note courante 1..10, `null` si non noté. */
  value: number | null;
  onRate: (score: number) => void;
  onClear: () => void;
  /** Identité encore en chargement : les étoiles tiennent leur place, inertes. */
  disabled?: boolean;
}

/**
 * Cinq étoiles au doigt, dix niveaux — `StarRatingMobile` de l'app : chaque
 * étoile porte deux zones (la moitié gauche vaut une demi-étoile), toucher de
 * nouveau sa note la retire.
 *
 * Pas d'aperçu au survol, contrairement aux étoiles du bureau : au doigt, le
 * navigateur simule un survol qui ne se lève qu'au toucher suivant — une note
 * retirée resterait affichée. Les zones débordent de l'étoile (44 px de haut,
 * et la moitié de l'écart de chaque côté) ; seule l'opacité des moitiés
 * pleines change, et un jet de confettis salue la note posée.
 */
export function TouchStarRating({ value, onRate, onClear, disabled = false }: TouchStarRatingProps) {
  const { t } = useTranslation("reco");
  const [burst, setBurst] = useState<{ id: number; star: number } | null>(null);
  const endBurst = useCallback(() => setBurst(null), []);

  const pick = (score: number) => {
    try {
      navigator.vibrate?.(8);
    } catch {
      /* pas de vibreur */
    }
    if (value === score) {
      onClear();
      return;
    }
    onRate(score);
    setBurst({ id: Date.now(), star: Math.ceil(score / 2) });
  };

  return (
    <div role="group" aria-label={t("yourRating")} className="flex items-center" style={{ gap: GAP }}>
      {[1, 2, 3, 4, 5].map((star) => {
        // Remplissage de CETTE étoile : 0, 0,5 ou 1 selon la note posée.
        const fraction = Math.min(Math.max((value ?? 0) - (star - 1) * 2, 0), 2) / 2;
        return (
          <span key={star} className="relative block" style={{ width: SIZE, height: SIZE }}>
            <StarShape className="text-content-tertiary" outline />
            <StarShape
              className={`text-[var(--brand-accent)] transition-opacity duration-150 ${fraction >= 0.5 ? "opacity-100" : "opacity-0"}`}
              clip="left"
            />
            <StarShape
              className={`text-[var(--brand-accent)] transition-opacity duration-150 ${fraction === 1 ? "opacity-100" : "opacity-0"}`}
              clip="right"
            />
            <HalfZone score={star * 2 - 1} side="left" current={value} disabled={disabled} onPick={pick} />
            <HalfZone score={star * 2} side="right" current={value} disabled={disabled} onPick={pick} />
            {burst?.star === star && <RatingBurst key={burst.id} onDone={endBurst} />}
          </span>
        );
      })}
    </div>
  );
}

function HalfZone({ score, side, current, disabled, onPick }: {
  score: number;
  side: "left" | "right";
  current: number | null;
  disabled: boolean;
  onPick: (score: number) => void;
}) {
  const { t } = useTranslation("reco");
  const isCurrent = current === score;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={isCurrent ? t("removeRatingAria", { score }) : t("rateAria", { score })}
      aria-pressed={isCurrent}
      onClick={() => onPick(score)}
      className="absolute rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]"
      style={{
        top: -REACH,
        bottom: -REACH,
        width: SIZE / 2 + GAP / 2,
        ...(side === "left" ? { left: -GAP / 2 } : { right: -GAP / 2 }),
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}
    />
  );
}

/**
 * L'étoile des cartes (`STAR_PATH`, grille 20). Pleine, elle est rognée à sa
 * moitié par un `clip-path` STATIQUE — seule l'opacité varie.
 */
function StarShape({ className, outline = false, clip }: { className: string; outline?: boolean; clip?: "left" | "right" }) {
  return (
    <svg
      className={`absolute inset-0 h-full w-full ${className}`}
      style={clip ? { clipPath: clip === "left" ? "inset(0 50% 0 0)" : "inset(0 0 0 50%)" } : undefined}
      viewBox={STAR_VIEWBOX}
      fill={outline ? "none" : "currentColor"}
      stroke={outline ? "currentColor" : "none"}
      strokeWidth={outline ? 1.2 : 0}
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={STAR_PATH} />
    </svg>
  );
}
