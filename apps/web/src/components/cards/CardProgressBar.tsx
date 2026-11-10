interface CardProgressBarProps {
  /** 0–100 inclusive. Returns null below 1 to avoid visual noise. */
  percent: number | null | undefined;
  /** D'avant la refonte : un filet au-dessus de la barre. La jauge flotte désormais dans l'image. */
  border?: boolean;
}

/**
 * La progression d'une carte : une JAUGE posée dans le bas de l'image, à quelques pixels des bords (le
 * prototype validé) — plus un trait collé au bord. Ce qui se mesure porte le dégradé de jauge
 * (`--progress-fill`), la même teinte que la barre du lecteur. Le remplissage est une ÉCHELLE
 * (`scaleX`), jamais une largeur.
 */
export function CardProgressBar({ percent }: CardProgressBarProps) {
  if (percent == null || percent < 1) return null;
  const ratio = Math.min(100, Math.max(0, percent)) / 100;

  return (
    <div
      // À 6 px du bas, 3 px de haut : le plateau du survol (12 px du bas) et la légende d'un
      // épisode passent AU-DESSUS d'elle — la progression reste lisible quand on décide de reprendre.
      className="absolute inset-x-2 bottom-1.5 h-[3px] overflow-hidden rounded-full bg-[rgba(255,255,255,0.24)]"
      aria-label={`Visionnage à ${Math.round(percent)}%`}
    >
      <div className="h-full origin-left rounded-full" style={{ transform: `scaleX(${ratio})`, background: "var(--progress-fill)" }} />
    </div>
  );
}
