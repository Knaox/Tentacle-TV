import { memo, type ReactNode } from "react";

interface StatsSectionProps {
  title: string;
  /** Une ligne sous le titre : ce que montre la section, dans quelle unité. */
  hint?: string;
  /** Posé à droite du titre (légende, lien). */
  trailing?: ReactNode;
  /** Sans carte : pour les rangées d'affiches, qui débordent sur toute la largeur. */
  bare?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Une section de la page, en deux grammaires seulement :
 *  • une RANGÉE d'affiches (`bare`) prend le titre des rangées de l'accueil —
 *    le rail de marque et le titre fort ;
 *  • une CARTE de chiffres prend un titre discret, sans ornement, dans une
 *    surface opaque (`--surface-1`, liseré fin) : ce sont les données qui
 *    parlent.
 * Aucun `backdrop-filter` : un fond opaque n'a rien à flouter (règle GPU).
 */
export const StatsSection = memo(function StatsSection({ title, hint, trailing, bare, className, children }: StatsSectionProps) {
  if (bare) {
    return (
      <section className={className} aria-label={title}>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              aria-hidden
              className="mt-1 h-5 w-[3px] flex-shrink-0 rounded-full"
              style={{ background: "linear-gradient(180deg, var(--brand), var(--brand-accent))" }}
            />
            <div className="min-w-0">
              <h2 className="text-heading-3 tracking-tight text-content-primary">{title}</h2>
              {hint && <p className="mt-0.5 text-[13px] leading-snug text-content-tertiary">{hint}</p>}
            </div>
          </div>
          {trailing}
        </div>
        {children}
      </section>
    );
  }
  return (
    <section aria-label={title} className={`rounded-2xl bg-[color:var(--surface-1)] p-5 ring-1 ring-line-subtle md:p-6 ${className ?? ""}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-content-primary">{title}</h2>
          {hint && <p className="mt-0.5 text-[13px] leading-snug text-content-tertiary">{hint}</p>}
        </div>
        {trailing}
      </div>
      {children}
    </section>
  );
});
