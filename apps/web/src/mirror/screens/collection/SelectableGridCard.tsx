import { memo, useState } from "react";
import { Check } from "lucide-react";
import { CardRatingBadge } from "../../../components/cards/CardRatingBadge";
import { Pressable } from "../../ui/Pressable";
import { ProgressBar } from "../../ui/ProgressBar";

/**
 * La carte de grille de Ma liste et Mes favoris (`watchlist/SelectableGridCard`
 * de l'app) : affiche 2:3 au rayon 12, `surface.s2` bordée d'un filet, note
 * en bas à gauche, progression 3 au ras du bas, coche blanche des vus (22) ;
 * en sélection, un voile avec une case ronde de 24 en haut à droite — cochée,
 * liseré violet de 2 et teinte violette. Titre 11 semi-gras à 6, année 10.
 */
export const SelectableGridCard = memo(function SelectableGridCard({
  posterUri, rating = null, title, year, progressPercent, watched, width, selectable, selected, onPress, onLongPress,
}: {
  posterUri: string;
  rating?: number | null;
  title: string;
  year?: number | null;
  progressPercent?: number | null;
  watched?: boolean;
  width: number;
  selectable?: boolean;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const showProgress = progressPercent != null && progressPercent > 0 && !watched;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ width }}
      aria-label={title}
      aria-pressed={selectable ? selected === true : undefined}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-line-subtle bg-surface-2">
        {!broken ? (
          <img
            src={posterUri}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setBroken(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-4xl font-extrabold text-content-disabled">
            {title.charAt(0).toUpperCase() || "?"}
          </span>
        )}
        <CardRatingBadge rating={rating} className="bottom-1.5 left-1.5" />
        {showProgress && <ProgressBar progress={(progressPercent ?? 0) / 100} className="absolute inset-x-0 bottom-0" />}
        {watched && (
          <span
            className="absolute right-[7px] top-[7px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-cta-primary-bg text-cta-primary-fg"
            style={{ boxShadow: "0 2px 4px rgba(0,0,0,0.35)" }}
          >
            <Check size={12} strokeWidth={3} aria-hidden />
          </span>
        )}
        {selectable && (
          <div
            className="absolute inset-0 flex items-start justify-end rounded-xl p-1"
            style={
              selected
                ? { border: "2px solid var(--brand)", background: "rgba(var(--brand-rgb), 0.18)" }
                : { background: "rgba(0, 0, 0, 0.35)" }
            }
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full border-2"
              style={
                selected
                  ? { background: "var(--brand-soft)", borderColor: "rgba(var(--brand-rgb), 0.5)" }
                  : { background: "rgba(0, 0, 0, 0.35)", borderColor: "var(--cta-brand-fg)" }
              }
            >
              {selected && <Check size={14} className="text-brand-light" aria-hidden />}
            </span>
          </div>
        )}
      </div>
      <p className="mt-1.5 truncate text-[11px] font-semibold tracking-[-0.1px] text-content-primary">{title}</p>
      {year != null && <p className="mt-0.5 text-[10px] font-medium tracking-[0.3px] text-content-tertiary">{year}</p>}
    </Pressable>
  );
});
