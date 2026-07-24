interface CardProgressBarProps {
  /** 0–100 inclusive. Returns null below 1 to avoid visual noise. */
  percent: number | null | undefined;
  /** Show a slim border on the bar; useful on light/cluttered backdrops. */
  border?: boolean;
}

/**
 * Barre de progression posée en bas des cartes.
 * Remplissage rose repris de la bannière d'accueil (`--progress-fill`), même
 * couleur que la barre du lecteur — une progression a une seule teinte.
 */
export function CardProgressBar({ percent, border = false }: CardProgressBarProps) {
  if (percent == null || percent < 1) return null;

  return (
    <div
      className="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden"
      style={{
        background: "rgba(0,0,0,0.55)",
        borderTop: border ? "1px solid rgba(0,0,0,0.4)" : undefined,
      }}
      aria-label={`Visionnage à ${Math.round(percent)}%`}
    >
      <div
        className="h-full"
        style={{
          width: `${Math.min(100, Math.max(0, percent))}%`,
          background: "var(--progress-fill)",
          boxShadow: "var(--progress-glow)",
        }}
      />
    </div>
  );
}
