import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface RowHeaderProps {
  title: string;
  /** Cible de « Tout voir », au bout de la ligne. */
  href?: string;
  /**
   * `always` : « Tout voir » est toujours visible (les rangées du web, refonte de nov. 2026 — on
   * ne trouve pas un lien qu'on ne voit pas). `hover`, le défaut : il ne paraît qu'au survol de
   * la rangée, comme avant — le client LG rend cet en-tête (`RowTv`) et son moteur de focus
   * écarte un lien à l'opacité nulle : visible, il deviendrait un arrêt de la télécommande au-dessus
   * de chaque rangée.
   */
  seeAll?: "always" | "hover";
  /** Posé juste après le titre (la puce du filtre de plateformes). */
  trailing?: ReactNode;
}

/**
 * Titre de rangée. Le rail de marque à sa gauche est la signature qui relie
 * les rangées, la bannière et l'en-tête de bibliothèque : il s'étire au survol
 * de la rangée, ce qui indique la zone active sans rien déplacer.
 *
 * Il s'étire par `scale-y`, jamais par sa hauteur : de 20 à 28 px, il
 * dépassait la ligne du titre et grandissait l'en-tête de 2 px — toutes les
 * cartes de la rangée descendaient de 2 px au survol (recette du 14/10), et
 * la page se remettait en page à chaque image des 300 ms de la transition.
 */
export function RowHeader({ title, href, trailing, seeAll = "hover" }: RowHeaderProps) {
  const { t } = useTranslation("common");

  return (
    // `mb-1` et non `mb-3` : le scroller de `MediaRow` a besoin de `pt-8` pour
    // laisser passer le débord du survol, et ces 8 px de moins ici gardent
    // l'écart titre → cartes exactement où il était (36 px).
    <div className="row-gutter mb-1 flex items-center gap-2.5">
      <h2 className="text-heading-3 tracking-tight text-content-primary md:text-heading-2">{title}</h2>

      {trailing}

      {href && (
        <Link
          to={href}
          className={`lg-pill btn btn-sm btn-ghost ml-auto shrink-0 ${
            seeAll === "always" ? "" : "opacity-0 transition-[opacity,transform,background-color,color] duration-hover focus-visible:opacity-100 group-hover/row:opacity-100"
          }`}
        >
          {t("common:seeAll")}
          <CaretRightIcon weight="bold" className="h-3 w-3" aria-hidden />
        </Link>
      )}
    </div>
  );
}
