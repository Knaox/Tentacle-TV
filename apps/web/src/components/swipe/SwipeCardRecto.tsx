import { useTranslation } from "react-i18next";
import { Check, Compass, Sparkles, Star, TrendingUp } from "lucide-react";
import type { SwipeCard } from "@tentacle-tv/api-client";

interface SwipeCardRectoProps {
  card: SwipeCard;
  title: string;
  format: string;
}

/**
 * Le texte du recto, posé sur l'affiche (blanc/noir constants) : en haut
 * l'origine de la carte et sa note ; en bas, sur un dégradé, le titre, le
 * format, les genres, la présence en bibliothèque et la raison. La place du
 * bouton d'info (en bas à droite) est réservée sur TOUTES les cartes : celle
 * qui monte en tête de pile ne recompose pas son titre au moment où on la voit.
 */
export function SwipeCardRecto({ card, title, format }: SwipeCardRectoProps) {
  const { t } = useTranslation("swipe");
  return (
    <>
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        {card.source !== "taste" ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/65 px-2.5 py-1 text-xs font-semibold text-white">
            {card.source === "popular" ? <TrendingUp size={13} aria-hidden /> : <Compass size={13} aria-hidden />}
            {card.source === "popular" ? t("sourcePopular") : t("sourceExplore")}
          </span>
        ) : (
          <span />
        )}
        {card.voteAverage != null && card.voteAverage > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/65 px-2.5 py-1 text-xs font-semibold tabular-nums text-white">
            <Star size={12} className="fill-current text-amber-300" aria-hidden />
            {card.voteAverage.toFixed(1)}
          </span>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pb-5 pl-5 pr-16 pt-24 text-white">
        <h2 className="text-2xl font-bold leading-tight [text-wrap:balance]">{title}</h2>
        <p className="mt-1 text-sm text-white/80">{format}</p>
        {card.genres.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {card.genres.map((g) => (
              <li key={g} className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-medium">
                {g}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-col gap-1 text-xs font-medium text-white/85">
          <span className="inline-flex items-center gap-1.5">
            {card.jellyfinItemId ? <Check size={14} aria-hidden /> : <span className="h-1.5 w-1.5 rounded-full bg-white/60" aria-hidden />}
            {card.jellyfinItemId ? t("inLibrary") : t("notInLibrary")}
          </span>
          {card.reason && (
            <span className="inline-flex items-center gap-1.5">
              <Sparkles size={14} aria-hidden />
              <span className="truncate">{t("reason", { title: card.reason })}</span>
            </span>
          )}
        </div>
      </div>
    </>
  );
}
