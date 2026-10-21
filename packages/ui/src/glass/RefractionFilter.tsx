import { Fragment, memo, useMemo } from "react";

import {
  buildRefractionMap,
  refractionMapKey,
  type RefractionGeometry,
} from "./refractionMap";

/**
 * Le filtre SVG de réfraction d'UNE surface, référencé par son
 * `backdrop-filter: url(#id) …` (Chromium seulement : WebKit ignore la partie
 * SVG d'un `backdrop-filter`, voir `engine.ts`).
 *
 * La carte de déplacement est calculée pour la géométrie exacte de la surface
 * (`refractionMap.ts`), mise en image une fois, et partagée par toutes les
 * surfaces de même taille — une rangée de pastilles identiques n'en calcule
 * qu'une.
 *
 * `color-interpolation-filters="sRGB"` n'est pas un détail : par défaut, SVG
 * convertit ses entrées en RVB LINÉAIRE, et le gris neutre 128 de la carte
 * deviendrait ~55 — tout le fond glisserait d'un bloc vers le haut à gauche.
 *
 * Ne dessine rien : un `<svg>` de taille nulle qui ne porte que le filtre.
 */

export interface RefractionFilterProps extends RefractionGeometry {
  /** Identifiant du filtre, unique dans le document. */
  id: string;
  /** Décalage maximal au ras du bord, en px CSS. */
  strength: number;
  /**
   * Écart relatif des trois canaux (0 = aucun) : la frange chromatique d'un
   * verre épais. Coûte deux passes de plus : à réserver au verre `clear`.
   */
  dispersion?: number;
}

/** Cartes déjà mises en image, par géométrie. Petite : les tailles se répètent. */
const URL_CACHE = new Map<string, string>();
const URL_CACHE_LIMIT = 32;

/** Met la carte en image PNG (`data:`), avec cache. `null` hors navigateur. */
export function refractionMapUrl(geometry: RefractionGeometry): string | null {
  const key = refractionMapKey(geometry);
  const cached = URL_CACHE.get(key);
  if (cached !== undefined) {
    // Remis en tête : le cache garde les plus récemment servies.
    URL_CACHE.delete(key);
    URL_CACHE.set(key, cached);
    return cached;
  }
  if (typeof document === "undefined") return null;
  const map = buildRefractionMap(geometry);
  const canvas = document.createElement("canvas");
  canvas.width = map.width;
  canvas.height = map.height;
  const context = canvas.getContext("2d");
  if (context === null) return null;
  context.putImageData(new ImageData(map.data, map.width, map.height), 0, 0);
  const url = canvas.toDataURL("image/png");
  URL_CACHE.set(key, url);
  if (URL_CACHE.size > URL_CACHE_LIMIT) {
    const oldest = URL_CACHE.keys().next().value;
    if (oldest !== undefined) URL_CACHE.delete(oldest);
  }
  return url;
}

const CHANNEL_MATRICES = [
  "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0",
  "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0",
  "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0",
] as const;

function RefractionFilterImpl({
  id,
  width,
  height,
  radius,
  bezel,
  strength,
  dispersion = 0,
}: RefractionFilterProps) {
  const url = useMemo(
    () => refractionMapUrl({ width, height, radius, bezel }),
    [width, height, radius, bezel],
  );
  if (url === null || width < 1 || height < 1) return null;

  // La carte encode ±1 sur ±127,5 : l'échelle vaut deux fois le décalage voulu.
  const scale = strength * 2;
  const passes =
    dispersion > 0 ? [scale * (1 + dispersion), scale, scale * (1 - dispersion)] : [scale];

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", pointerEvents: "none" }}
    >
      <defs>
        <filter
          id={id}
          x="0"
          y="0"
          width={width}
          height={height}
          filterUnits="userSpaceOnUse"
          primitiveUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feImage
            href={url}
            x="0"
            y="0"
            width={width}
            height={height}
            preserveAspectRatio="none"
            result="map"
          />
          {passes.length === 1 ? (
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={passes[0]}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          ) : (
            <>
              {passes.map((passScale, channel) => (
                // Pas de <g> : un filtre n'accepte que des primitives pour enfants.
                <Fragment key={channel}>
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="map"
                    scale={passScale}
                    xChannelSelector="R"
                    yChannelSelector="G"
                    result={`d${channel}`}
                  />
                  <feColorMatrix
                    in={`d${channel}`}
                    type="matrix"
                    values={CHANNEL_MATRICES[channel]}
                    result={`c${channel}`}
                  />
                </Fragment>
              ))}
              <feComposite in="c0" in2="c1" operator="arithmetic" k2="1" k3="1" result="c01" />
              <feComposite in="c01" in2="c2" operator="arithmetic" k2="1" k3="1" />
            </>
          )}
        </filter>
      </defs>
    </svg>
  );
}

export const RefractionFilter = memo(RefractionFilterImpl);
