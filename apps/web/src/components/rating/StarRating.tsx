import { ON_MEDIA_ACCENT_TEXT } from "../cards/onMedia";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { RatingBurst } from "./RatingBurst";

interface StarRatingProps {
  /** Note courante 1..10, null si non noté. */
  value: number | null;
  onRate: (score: number) => void;
  onClear: () => void;
  /** `preview` : à l'échelle de la mini-carte d'aperçu (`--pv-star`, `cards/preview/previewActions.css`). */
  size?: "xs" | "sm" | "md" | "preview";
  disabled?: boolean;
  /** « onMedia » : posé sur une affiche — contour blanc et ombre portée
   *  STATIQUES (les jetons de thème y sont illisibles, cf. capture du survol
   *  où les étoiles disparaissaient sur les affiches claires). */
  tone?: "themed" | "onMedia";
}

const SIZE_CLASS = { xs: "h-3.5 w-3.5", sm: "h-4 w-4", md: "h-6 w-6", preview: "card-preview-star" } as const;

/**
 * Cinq étoiles, dix niveaux (demi-étoiles), note interne 1..10 — jamais 0.
 * Survol = prévisualisation ; clic = valider ; re-clic sur la même valeur =
 * retrait. Chaque étoile porte DEUX zones cliquables (moitiés gauche/droite),
 * ce qui donne aussi les dix valeurs au clavier, sans arithmétique de souris.
 * Animations : opacité (remplissage) et transform (survol) uniquement — plus
 * un jet de confettis (transform/opacité) sur l'étoile qui vient d'être validée.
 */
export function StarRating({
  value,
  onRate,
  onClear,
  size = "md",
  disabled,
  tone = "themed",
}: StarRatingProps) {
  const { t } = useTranslation("reco");
  const [hovered, setHovered] = useState<number | null>(null);
  // Jet de confettis sur l'étoile validée : monté le temps du jet, jamais sur un retrait.
  const [burst, setBurst] = useState<{ id: number; star: number } | null>(null);
  const endBurst = useCallback(() => setBurst(null), []);
  const pick = (score: number) => {
    if (value === score) {
      onClear();
      return;
    }
    onRate(score);
    setBurst({ id: Date.now(), star: Math.ceil(score / 2) });
  };

  const displayed = hovered ?? value ?? 0;
  const starClass = SIZE_CLASS[size];
  // L'étoile VIDE est l'affordance du contrôle : elle tient 3:1 sur la page dans les deux thèmes.
  // (`text-content-tertiary opacity-40` la laissait à 1,8:1 sur le papier, 1,7:1 sur l'encre.)
  const outlineClass =
    tone === "onMedia" ? "text-on-media-secondary" : "text-content-quaternary";
  // La note posée : un état ACTIF, à la teinte franche (celle du sombre sur une image).
  const filledClass = tone === "onMedia" ? ON_MEDIA_ACCENT_TEXT : "text-accent";
  // Filtre STATIQUE (jamais animé) sur le conteneur de l'étoile : un seul
  // drop-shadow pour les trois glyphes, pas trois.
  const starShadow = tone === "onMedia" ? "drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]" : "";

  return (
    <div
      role="group"
      aria-label={t("yourRating")}
      className="flex items-center"
      onMouseLeave={() => setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        // Remplissage de CETTE étoile : 0, 0.5 ou 1 selon la note affichée.
        const fraction = Math.min(Math.max(displayed - (star - 1) * 2, 0), 2) / 2;
        return (
          <span
            key={star}
            className={`relative ${starClass} ${starShadow}`}
          >
            <StarGlyph className={`absolute inset-0 ${starClass} ${outlineClass}`} outline />
            <StarGlyph
              className={`absolute inset-0 ${starClass} ${filledClass} transition-opacity duration-hover ${
                fraction >= 0.5 ? "opacity-100" : "opacity-0"
              }`}
              clip="left"
            />
            <StarGlyph
              className={`absolute inset-0 ${starClass} ${filledClass} transition-opacity duration-hover ${
                fraction === 1 ? "opacity-100" : "opacity-0"
              }`}
              clip="right"
            />
            <HalfButton
              score={star * 2 - 1}
              side="left"
              current={value}
              disabled={disabled}
              onHover={setHovered}
              onPick={pick}
            />
            <HalfButton
              score={star * 2}
              side="right"
              current={value}
              disabled={disabled}
              onHover={setHovered}
              onPick={pick}
            />
            {burst?.star === star && <RatingBurst key={burst.id} onDone={endBurst} />}
          </span>
        );
      })}
    </div>
  );
}

function HalfButton({
  score,
  side,
  current,
  disabled,
  onHover,
  onPick,
}: {
  score: number;
  side: "left" | "right";
  current: number | null;
  disabled?: boolean;
  onHover: (score: number | null) => void;
  onPick: (score: number) => void;
}) {
  const { t } = useTranslation("reco");
  const isCurrent = current === score;
  const label = isCurrent ? t("removeRatingAria", { score }) : t("rateAria", { score });
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={isCurrent}
      onMouseEnter={() => onHover(score)}
      onFocus={() => onHover(score)}
      onBlur={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onPick(score);
      }}
      className={`absolute inset-y-0 w-1/2 ${side === "left" ? "left-0" : "right-0"} focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--border-focus)]`}
    />
  );
}

function StarGlyph({
  className,
  outline,
  clip,
}: {
  className: string;
  outline?: boolean;
  clip?: "left" | "right";
}) {
  // clip-path STATIQUE (jamais animé) : la moitié gauche et la moitié droite
  // du glyphe plein, dont seule l'OPACITÉ varie.
  const clipStyle =
    clip === "left"
      ? { clipPath: "inset(0 50% 0 0)" }
      : clip === "right"
        ? { clipPath: "inset(0 0 0 50%)" }
        : undefined;
  return <StarIcon className={className} style={clipStyle} weight={outline ? "regular" : "fill"} aria-hidden />;
}
