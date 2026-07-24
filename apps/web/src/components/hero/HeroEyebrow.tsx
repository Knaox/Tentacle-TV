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
      <span
        aria-hidden
        className="h-4 w-[3px] flex-shrink-0 rounded-full"
        style={{
          background: "linear-gradient(180deg, var(--brand-light), var(--brand-accent))",
          boxShadow: "0 0 12px rgba(var(--brand-rgb), 0.6)",
        }}
      />
      <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-on-media-primary drop-shadow-[0_1px_4px_var(--on-media-shadow)]">
        {label}
      </span>
      {hint && (
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-media-secondary">
          {hint}
        </span>
      )}
    </div>
  );
}
