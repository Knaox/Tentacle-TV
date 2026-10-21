/**
 * `GlassFusion` — le conteneur où des verres voisins se rejoignent
 * (`GlassEffectContainer` de SwiftUI).
 *
 * Les enfants qui portent `data-lg-fuse="<id>"` sont TRANSPARENTS : ce sont
 * leurs couches, dessinées ici derrière eux, qui portent le verre. Deux
 * enfants à moins de `spacing` px partagent une seule forme ; quand la mise
 * en page les rapproche ou les éloigne, les formes s'étirent l'une vers
 * l'autre (ou se détachent) au ressort `morph` — rien que des `transform`
 * (animation `layout` de framer) et des `opacity` (cf. `fusion.ts`).
 *
 * Mesure : au rendu du conteneur (les enfants ont pu bouger) et quand une
 * taille change (ResizeObserver) ; jamais par image.
 *
 * `shapeClassName` : la surface de verre (celle de lg-tokens) appliquée à
 * chaque couche ; `radius` : le rayon de la forme, corrigé pendant
 * l'étirement par framer.
 */

import { motion, useReducedMotion } from "framer-motion";
import { memo, useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { fusionLayout, type FusionMember, type FusionShape } from "./fusion";
import { GLASS_FRAMER, GLASS_MORPH_REDUCED } from "./glassMotion";

export interface GlassFusionProps {
  children: ReactNode;
  /** Distance (px) sous laquelle deux verres se rejoignent ; 0 = jamais. */
  spacing?: number;
  radius?: number;
  className?: string;
  shapeClassName?: string;
}

const sameShapes = (a: FusionShape[], b: FusionShape[]): boolean =>
  a.length === b.length &&
  a.every((s, i) => {
    const o = b[i];
    return (
      s.id === o.id &&
      s.visible === o.visible &&
      s.rect.x === o.rect.x &&
      s.rect.y === o.rect.y &&
      s.rect.width === o.rect.width &&
      s.rect.height === o.rect.height
    );
  });

function measure(container: HTMLElement): FusionMember[] {
  const origin = container.getBoundingClientRect();
  return [...container.querySelectorAll<HTMLElement>("[data-lg-fuse]")].map((el) => {
    const r = el.getBoundingClientRect();
    // Arrondi au pixel : une mesure à 0,01 px près relancerait l'animation.
    return {
      id: el.dataset.lgFuse ?? "",
      rect: {
        x: Math.round(r.left - origin.left),
        y: Math.round(r.top - origin.top),
        width: Math.round(r.width),
        height: Math.round(r.height),
      },
    };
  });
}

export const GlassFusion = memo(function GlassFusion({
  children,
  spacing = 12,
  radius = 999,
  className,
  shapeClassName,
}: GlassFusionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shapes, setShapes] = useState<FusionShape[]>([]);
  const reduced = useReducedMotion();

  const update = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const next = fusionLayout(measure(container), spacing);
    setShapes((prev) => (sameShapes(prev, next) ? prev : next));
  }, [spacing]);

  // Sans tableau de dépendances : chaque rendu peut avoir déplacé un enfant.
  // `sameShapes` coupe la boucle dès que rien n'a bougé.
  useLayoutEffect(update);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(() => update());
    observer.observe(container);
    container.querySelectorAll("[data-lg-fuse]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [update, shapes.length]);

  const transition = reduced ? GLASS_MORPH_REDUCED : { layout: GLASS_FRAMER.morph, opacity: GLASS_FRAMER.settle };

  return (
    <div ref={containerRef} className={className} style={{ position: "relative" }}>
      {shapes.map((s) => (
        <motion.div
          key={s.id}
          aria-hidden="true"
          className={shapeClassName ? `lg-fusion-shape ${shapeClassName}` : "lg-fusion-shape"}
          layout={!reduced}
          initial={false}
          animate={{ opacity: s.visible ? 1 : 0 }}
          transition={transition}
          style={{
            // Position par left/top, pas par transform : l'animation `layout`
            // mesure la boîte de mise en page et anime l'écart en transform.
            left: s.rect.x,
            top: s.rect.y,
            width: s.rect.width,
            height: s.rect.height,
            borderRadius: Math.min(radius, s.rect.height / 2),
          }}
        />
      ))}
      {children}
    </div>
  );
});
