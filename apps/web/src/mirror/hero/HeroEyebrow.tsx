/**
 * `HeroEyebrow` de l'app : rail de marque lumineux (3 × 16, dégradé violet
 * clair → rose, halo violet) et libellé 11 gras en capitales, espacé de 2,4,
 * en `onMedia` — c'est le rail qui porte la marque, jamais le texte.
 */
export function HeroEyebrow({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="h-4 w-[3px] shrink-0 rounded-sm"
        style={{
          background: "linear-gradient(180deg, var(--brand-light), var(--brand-accent))",
          boxShadow: "0 0 6px rgba(var(--brand-rgb), 0.6)",
        }}
      />
      <span
        className="truncate text-[11px] font-bold uppercase tracking-[2.4px] text-on-media-primary"
        style={{ textShadow: "0 1px 4px var(--on-media-shadow)" }}
      >
        {label}
      </span>
      {hint ? <span className="truncate text-[11px] font-semibold uppercase tracking-[1.5px] text-on-media-secondary">{hint}</span> : null}
    </div>
  );
}
