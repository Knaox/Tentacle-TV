import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface RowHeaderProps {
  title: string;
  /** Cible de « Tout voir » — révélé au survol de la rangée. */
  href?: string;
  /** Posé juste après le titre, TOUJOURS visible (la puce du filtre de
   *  plateformes) — là où « Tout voir » ne paraît qu'au survol. */
  trailing?: ReactNode;
}

/**
 * Titre de rangée. Le rail de marque à sa gauche est la signature qui relie
 * les rangées, la bannière et l'en-tête de bibliothèque : il s'étire au survol
 * de la rangée, ce qui indique la zone active sans rien déplacer.
 */
export function RowHeader({ title, href, trailing }: RowHeaderProps) {
  const { t } = useTranslation("common");

  return (
    // `mb-1` et non `mb-3` : le scroller de `MediaRow` a besoin de `pt-8` pour
    // laisser passer le débord du survol, et ces 8 px de moins ici gardent
    // l'écart titre → cartes exactement où il était (36 px).
    <div className="row-gutter mb-1 flex items-center gap-2.5">
      <span
        aria-hidden
        className="h-5 w-[3px] flex-shrink-0 rounded-full transition-all duration-300 group-hover/row:h-7 motion-reduce:transition-none"
        style={{ background: "linear-gradient(180deg, var(--brand), var(--brand-accent))" }}
      />

      <h2 className="text-heading-3 tracking-tight text-content-primary md:text-heading-2">{title}</h2>

      {trailing}

      {href && (
        <Link
          to={href}
          className="-translate-x-2 flex items-center gap-1 rounded-full bg-cta-ghost-bg px-2.5 py-1 text-xs font-medium text-content-tertiary opacity-0 transition-all duration-300 hover:bg-cta-ghost-bg-hover hover:text-content-primary group-hover/row:translate-x-0 group-hover/row:opacity-100 motion-reduce:transition-none"
        >
          {t("common:seeAll")}
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </div>
  );
}
