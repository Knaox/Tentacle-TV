import { useReducedMotion } from "framer-motion";

/** Même sous-échelle que le web : le flou se calcule sur 1/64 de la surface. */
const RENDER_DOWNSCALE = 8;

interface AmbilightLayerProps {
  url: string | null;
  layerKey: string;
  opacity?: string;
  className?: string;
}

/**
 * Le halo « ambilight » des bannières, sans calque de compositeur propre.
 *
 * Même dessin que le web — l'image source minuscule, floutée en sous-échelle
 * puis agrandie huit fois, derrière la carte — moins le `will-change:
 * transform` de l'image. Sur le web il sert le zoom lent du halo : le flou y
 * est rastérisé une fois et l'agrandissement animé ne coûte qu'une
 * transformation. Le téléviseur n'a pas ce zoom — framer-motion y est un shim
 * qui ne joue rien —, et un calque COMPOSÉ qui porte un `filter` se voit
 * appliquer ce filtre par le compositeur à chaque image, à l'échelle de
 * l'écran, sous-échelle comprise : la bannière entière floutée soixante fois
 * par seconde. Mesuré sur la C3 : 10 ms de processeur graphique par image,
 * soit les deux tiers de la composition de l'accueil.
 *
 * Sans calque propre, le flou est calculé à la rastérisation, une fois par
 * diapositive, sur l'image réduite — l'économie que le web visait.
 */
export function AmbilightLayer({
  url,
  layerKey,
  opacity = "var(--hero-ambilight-opacity)",
  className = "absolute inset-0",
}: AmbilightLayerProps) {
  const reduced = useReducedMotion();
  if (reduced || !url) return null;

  return (
    <div aria-hidden className={`pointer-events-none ${className}`} style={{ opacity }}>
      <div
        className="absolute left-0 top-0"
        style={{
          width: `${100 / RENDER_DOWNSCALE}%`,
          height: `${100 / RENDER_DOWNSCALE}%`,
          transform: `scale(${RENDER_DOWNSCALE})`,
          transformOrigin: "top left",
        }}
      >
        <img
          key={layerKey}
          src={url}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            filter:
              `blur(calc(var(--hero-ambilight-blur) / ${RENDER_DOWNSCALE}))` +
              " saturate(var(--hero-ambilight-sat))",
          }}
        />
      </div>
    </div>
  );
}
