import { useState } from "react";
import { useTranslation } from "react-i18next";

interface StarRatingProps {
  /** Note courante 1..10, null si non noté. */
  value: number | null;
  onRate: (score: number) => void;
  onClear: () => void;
  size?: "sm" | "md";
  disabled?: boolean;
}

const SIZE_CLASS = { sm: "h-4 w-4", md: "h-6 w-6" } as const;

/**
 * Cinq étoiles, dix niveaux (demi-étoiles), note interne 1..10 — jamais 0.
 * Survol = prévisualisation ; clic = valider ; re-clic sur la même valeur =
 * retrait. Chaque étoile porte DEUX zones cliquables (moitiés gauche/droite),
 * ce qui donne aussi les dix valeurs au clavier, sans arithmétique de souris.
 * Animations : opacité (remplissage) et transform (survol) uniquement.
 */
export function StarRating({ value, onRate, onClear, size = "md", disabled }: StarRatingProps) {
  const { t } = useTranslation("reco");
  const [hovered, setHovered] = useState<number | null>(null);

  const displayed = hovered ?? value ?? 0;
  const starClass = SIZE_CLASS[size];

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
        const isHoveredStar = hovered !== null && Math.ceil(hovered / 2) === star;
        return (
          <span
            key={star}
            className={`relative ${starClass} transition-transform duration-150 ${
              isHoveredStar ? "scale-110" : ""
            }`}
          >
            <StarGlyph className={`absolute inset-0 ${starClass} text-content-tertiary opacity-40`} outline />
            <StarGlyph
              className={`absolute inset-0 ${starClass} text-[var(--brand-accent)] transition-opacity duration-150 ${
                fraction >= 0.5 ? "opacity-100" : "opacity-0"
              }`}
              clip="left"
            />
            <StarGlyph
              className={`absolute inset-0 ${starClass} text-[var(--brand-accent)] transition-opacity duration-150 ${
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
              onPick={(s) => (value === s ? onClear() : onRate(s))}
            />
            <HalfButton
              score={star * 2}
              side="right"
              current={value}
              disabled={disabled}
              onHover={setHovered}
              onPick={(s) => (value === s ? onClear() : onRate(s))}
            />
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
  return (
    <svg
      className={className}
      style={clipStyle}
      viewBox="0 0 24 24"
      fill={outline ? "none" : "currentColor"}
      stroke={outline ? "currentColor" : "none"}
      strokeWidth={outline ? 1.5 : 0}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
    </svg>
  );
}
