import { useEffect } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useRowScroll } from "../rows/useRowScroll";

interface NavOverflowScrollerProps {
  ariaLabel: string;
  children: ReactNode;
}

/**
 * Chevron de défilement de la barre : monté UNIQUEMENT en débordement (jamais
 * laissé à opacity:0 — règle GPU) et SANS backdrop-filter : il vit dans un
 * en-tête déjà flouté, un disque `backdrop-blur` de plus serait une passe de
 * compositing pour rien (ne pas reprendre le discClass de RowScrollControls).
 * `tabIndex={-1}` : les liens restent l'unique chemin clavier — le focus natif
 * fait déjà défiler le conteneur ; l'aria-label sert le contrôle vocal.
 */
function Arrow({ side, label, onClick }: { side: "left" | "right"; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      onClick={onClick}
      className={`fade-in-on-mount absolute top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-surface-2 text-content-secondary ring-1 ring-line-subtle transition-colors hover:bg-fill-soft hover:text-content-primary ${
        side === "left" ? "left-0" : "right-0"
      }`}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={side === "left" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
        />
      </svg>
    </button>
  );
}

/**
 * Scroller horizontal de la barre de navigation : la rangée de liens défilait
 * déjà (`overflow-x-auto scrollbar-hide`) mais RIEN ne le montrait — pas de
 * flèche, pas de fondu, et une souris sans trackpad n'avait aucun geste. En
 * fenêtre étroite, les entrées de droite paraissaient absentes.
 *
 * Réponse : fondu de bord (mask, cf. index.css) + flèches montées seulement en
 * débordement + molette verticale traduite en horizontal. Pas de menu « ⋯ » :
 * il doublonnerait l'épinglage (usePinnedNav + BrowseButton), exigerait une
 * passe de mesure par entrée, et casserait la pilule active glissante
 * (`layoutId` partagé) — compromis assumé.
 */
export function NavOverflowScroller({ ariaLabel, children }: NavOverflowScrollerProps) {
  const { t } = useTranslation("nav");
  const { scrollRef, canScrollLeft, canScrollRight, scrollByAmount, onScroll } = useRowScroll();

  // Re-mesure après CHAQUE rendu : les liens changent avec l'épinglage, les
  // bibliothèques ou la langue — le ResizeObserver du hook n'observe que la
  // boîte du conteneur et ne voit pas son contenu grandir. Deux lectures de
  // scroll par rendu, et les setState du hook s'auto-annulent à valeur égale.
  useEffect(() => {
    onScroll();
  });

  // Molette verticale → défilement horizontal, seulement en débordement.
  // Listener NATIF non-passif : le onWheel React est passif à la racine,
  // preventDefault y serait ignoré et la page défilerait derrière. Hors
  // débordement, la molette continue de faire défiler la page.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [scrollRef]);

  return (
    <nav aria-label={ariaLabel} className="relative min-w-0">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        data-fade-left={canScrollLeft}
        data-fade-right={canScrollRight}
        className="nav-edge-fade flex items-center gap-1 overflow-x-auto scrollbar-hide"
      >
        {children}
      </div>
      {canScrollLeft && <Arrow side="left" label={t("scrollLeft")} onClick={() => scrollByAmount("left")} />}
      {canScrollRight && (
        <Arrow side="right" label={t("scrollRight")} onClick={() => scrollByAmount("right")} />
      )}
    </nav>
  );
}
