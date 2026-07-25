import type { CSSProperties } from "react";

interface CollectionCardBadgesProps {
  /** Cible du fondu — vrai tant que le curseur est sur la carte. */
  shown: boolean;
  favorite: boolean;
  watchlisted: boolean;
  onToggleFavorite: () => void;
  onToggleWatchlist: () => void;
}

/**
 * Badges d'angle d'une carte de collection — favori et « à voir ».
 *
 * Posés SUR l'affiche : fond noir translucide et icônes blanches sont donc
 * constants dans les deux thèmes (règle « posé sur média »).
 *
 * Ils ne sont montés QUE pendant le survol, jamais laissés à `opacity: 0` :
 * chacun porte un `backdrop-filter`, et masquer ne décharge pas — la couche
 * composée subsiste, son arrière-plan est recopié et son flou recalculé. Deux
 * badges par carte, une quinzaine de cartes à l'écran : c'était une trentaine
 * de flous entretenus pour des boutons que personne ne voit. Le démontage est
 * retardé chez l'appelant (`useHoverMount`) le temps que le fondu se joue.
 */
export function CollectionCardBadges({
  shown,
  favorite,
  watchlisted,
  onToggleFavorite,
  onToggleWatchlist,
}: CollectionCardBadgesProps) {
  const badgeClass =
    "flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110";
  const badgeStyle: CSSProperties = { background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" };

  return (
    <div
      className="hover-reveal absolute right-1.5 top-1.5 z-10 flex flex-col gap-1"
      data-shown={shown}
      style={{ pointerEvents: "none", "--reveal-ms": "150ms" } as CSSProperties}
    >
      <div style={{ pointerEvents: "auto" }} className="flex flex-col gap-1">
        <button
          className={badgeClass}
          style={badgeStyle}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
        >
          {favorite ? (
            <svg className="h-3.5 w-3.5 text-red-400" viewBox="0 0 24 24" fill="currentColor"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
          ) : (
            <svg className="h-3.5 w-3.5 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
          )}
        </button>

        <button
          className={badgeClass}
          style={badgeStyle}
          onClick={(e) => {
            e.stopPropagation();
            onToggleWatchlist();
          }}
        >
          {watchlisted ? (
            <svg className="h-3.5 w-3.5 text-[var(--brand)]" viewBox="0 0 24 24" fill="currentColor"><path d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.537A.5.5 0 014 22.143V3a1 1 0 011-1z" /></svg>
          ) : (
            <svg className="h-3.5 w-3.5 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>
          )}
        </button>
      </div>
    </div>
  );
}
