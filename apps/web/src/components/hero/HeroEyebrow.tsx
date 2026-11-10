interface HeroEyebrowProps {
  label: string;
  /** Méta sobre à droite du libellé (qualité + langues d'un épisode). */
  hint?: string;
}

/**
 * Sur-titre de la bannière : rail de marque lumineux + libellé en capitales.
 *
 * Le même rail ouvre les titres de rangée et l'en-tête de bibliothèque — c'est
 * lui qui fait tenir ensemble les trois surfaces. Il est posé sur l'affiche,
 * donc en tokens `on-media-*` (blanc constant) dans les deux schémas.
 */
export function HeroEyebrow({ label, hint }: HeroEyebrowProps) {
  return (
    <div className="flex items-center gap-2.5">
      {/* Un surtitre d'encre (refonte de nov. 2026) : plus de barre au dégradé de marque. */}
      <span className="text-xs font-semibold uppercase tracking-[0.06em] text-on-media-primary drop-shadow-[0_1px_4px_var(--on-media-shadow)]">
        {label}
      </span>
      {hint && (
        <span className="text-xs font-semibold uppercase tracking-[0.06em] text-on-media-secondary">
          {hint}
        </span>
      )}
    </div>
  );
}
