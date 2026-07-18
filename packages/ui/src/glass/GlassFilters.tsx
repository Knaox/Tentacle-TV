/**
 * Définitions SVG partagées pour la réfraction Liquid Glass.
 *
 * Monté UNE SEULE FOIS près de la racine de l'app. Les surfaces verre y font
 * référence via `backdrop-filter: url(#tentacle-glass-refract)`.
 *
 * Principe : `feDisplacementMap` déplace chaque pixel du backdrop selon les
 * canaux R et G d'une carte de déplacement. On génère cette carte avec deux
 * dégradés croisés, ce qui courbe l'image vers les bords — l'effet de lentille
 * d'un bord biseauté. Trois passes légèrement décalées produisent l'aberration
 * chromatique (frange colorée sur les bords), signature du matériau d'Apple.
 *
 * Ne rend RIEN visuellement : uniquement des `<defs>` dans un SVG de taille nulle.
 */

const REFRACT_ID = "tentacle-glass-refract";
const MAP_ID = "tentacle-glass-map";

export const GLASS_FILTER_ID = REFRACT_ID;

export function GlassFilters() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", pointerEvents: "none" }}
    >
      <defs>
        {/* Carte de déplacement : rouge = axe X, vert = axe Y. Le gris neutre
            (128,128) au centre signifie « aucun déplacement » ; les bords
            s'écartent de ce neutre, donc seule la périphérie se courbe. */}
        <linearGradient id={`${MAP_ID}-x`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000" />
          <stop offset="18%" stopColor="#808080" />
          <stop offset="82%" stopColor="#808080" />
          <stop offset="100%" stopColor="#fff" />
        </linearGradient>
        <linearGradient id={`${MAP_ID}-y`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" />
          <stop offset="18%" stopColor="#808080" />
          <stop offset="82%" stopColor="#808080" />
          <stop offset="100%" stopColor="#fff" />
        </linearGradient>

        <filter id={REFRACT_ID} x="0%" y="0%" width="100%" height="100%">
          {/* Compose la carte : X dans le rouge, Y dans le vert. */}
          <feImage
            href={`data:image/svg+xml;utf8,${encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">` +
                `<defs>` +
                `<linearGradient id="x" x1="0" y1="0" x2="1" y2="0">` +
                `<stop offset="0%" stop-color="#000"/><stop offset="18%" stop-color="#808080"/>` +
                `<stop offset="82%" stop-color="#808080"/><stop offset="100%" stop-color="#fff"/>` +
                `</linearGradient>` +
                `<linearGradient id="y" x1="0" y1="0" x2="0" y2="1">` +
                `<stop offset="0%" stop-color="#000"/><stop offset="18%" stop-color="#808080"/>` +
                `<stop offset="82%" stop-color="#808080"/><stop offset="100%" stop-color="#fff"/>` +
                `</linearGradient>` +
                `</defs>` +
                `<rect width="100" height="100" fill="url(#x)"/>` +
                `<rect width="100" height="100" fill="url(#y)" style="mix-blend-mode:screen"/>` +
                `</svg>`,
            )}`}
            result="map"
            preserveAspectRatio="none"
          />

          {/* Trois passes d'amplitude légèrement différente = aberration
              chromatique. Chaque passe est isolée sur un canal via feColorMatrix,
              puis les trois sont recomposées. */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale="14"
            xChannelSelector="R"
            yChannelSelector="G"
            result="disp-r"
          />
          <feColorMatrix
            in="disp-r"
            type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="chan-r"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale="11"
            xChannelSelector="R"
            yChannelSelector="G"
            result="disp-g"
          />
          <feColorMatrix
            in="disp-g"
            type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="chan-g"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale="8"
            xChannelSelector="R"
            yChannelSelector="G"
            result="disp-b"
          />
          <feColorMatrix
            in="disp-b"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
            result="chan-b"
          />

          <feBlend in="chan-r" in2="chan-g" mode="screen" result="rg" />
          <feBlend in="rg" in2="chan-b" mode="screen" result="rgb" />

          {/* Léger flou final : sans super-sampling, le displacement produit un
              rendu pixelisé sur les bords. Le flou l'atténue. */}
          <feGaussianBlur in="rgb" stdDeviation="0.4" />
        </filter>
      </defs>
    </svg>
  );
}
