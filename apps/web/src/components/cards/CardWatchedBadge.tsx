/**
 * Coche « vu » posée dans l'angle d'une vignette.
 *
 * Extraite de `PosterTile` sans rien changer à son rendu : le catalogue hors
 * ligne doit afficher la MÊME marque que les cartes en ligne. Un second disque
 * blanc recopié ailleurs aurait dérivé au premier ajustement.
 *
 * Blanc sur noir constants dans les deux thèmes — la pastille est posée sur une
 * affiche, pas sur le fond de l'application (règle « posé sur média »).
 */

interface CardWatchedBadgeProps {
  /** Libellé lu par les lecteurs d'écran (le SVG seul ne dit rien). */
  label: string;
}

export function CardWatchedBadge({ label }: CardWatchedBadgeProps) {
  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className="absolute right-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black shadow"
    >
      <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}
