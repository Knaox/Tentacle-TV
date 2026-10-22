import { Fragment, memo } from "react";

import {
  buildLensMaps,
  refractionMapKey,
  type RefractionGeometry,
  type RefractionMap,
  type SpecularLight,
} from "./refractionMap";

/**
 * Le filtre SVG d'UNE lentille de verre, référencé par le `backdrop-filter`
 * de sa surface (Chromium seulement : WebKit ignore la partie SVG d'un
 * `backdrop-filter`, voir `engine.ts`).
 *
 * Il fait deux choses, dans cet ordre : RÉFRACTER le fond au biseau (carte de
 * déplacement calculée pour la forme exacte, `refractionMap.ts`), puis poser
 * la LUMIÈRE du bord (carte spéculaire) par-dessus. Le léger givre, la
 * saturation et la luminosité se règlent AVANT, en fonctions CSS du même
 * `backdrop-filter` (`blur() saturate() brightness() url(#…)`) : placés après,
 * ils flouteraient le liseré.
 *
 * Les cartes sont mises en image une fois et partagées par toutes les surfaces
 * de même géométrie — une rangée de pastilles identiques n'en calcule qu'une.
 *
 * `color-interpolation-filters="sRGB"` n'est pas un détail : par défaut, SVG
 * passe ses entrées en RVB LINÉAIRE, le gris neutre 128 de la carte deviendrait
 * ~55 et tout le fond glisserait d'un bloc vers le haut à gauche.
 *
 * Ne dessine rien : un `<svg>` de taille nulle qui ne porte que le filtre.
 */

export interface RefractionFilterProps extends RefractionGeometry {
  /** Identifiant du filtre, unique dans le document. */
  id: string;
  /** Décalage maximal de l'image, en px CSS. */
  strength: number;
  /**
   * Écart relatif des trois canaux (0 = aucun) : la frange chromatique d'un
   * verre épais. Coûte deux passes de plus : à réserver au verre `clear`.
   */
  dispersion?: number;
  /** La lumière du bord ; absente, aucun liseré n'est posé. */
  light?: SpecularLight;
}

/** Cartes déjà mises en image, par géométrie. Petit : les tailles se répètent. */
const URL_CACHE = new Map<string, { displacement: string; specular: string | null }>();
const URL_CACHE_LIMIT = 32;

function toUrl(map: RefractionMap): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = map.width;
  canvas.height = map.height;
  const context = canvas.getContext("2d");
  if (context === null) return null;
  context.putImageData(new ImageData(map.data, map.width, map.height), 0, 0);
  return canvas.toDataURL("image/png");
}

/** Met les cartes en images PNG (`data:`), avec cache. `null` hors navigateur. */
export function lensMapUrls(
  geometry: RefractionGeometry,
  light?: SpecularLight,
): { displacement: string; specular: string | null } | null {
  const key = refractionMapKey(geometry, light);
  const cached = URL_CACHE.get(key);
  if (cached !== undefined) {
    // Remis en tête : le cache garde les plus récemment servies.
    URL_CACHE.delete(key);
    URL_CACHE.set(key, cached);
    return cached;
  }
  if (typeof document === "undefined") return null;
  const maps = buildLensMaps(geometry, light);
  const displacement = toUrl(maps.displacement);
  if (displacement === null) return null;
  const urls = { displacement, specular: maps.specular ? toUrl(maps.specular) : null };
  URL_CACHE.set(key, urls);
  if (URL_CACHE.size > URL_CACHE_LIMIT) {
    const oldest = URL_CACHE.keys().next().value;
    if (oldest !== undefined) URL_CACHE.delete(oldest);
  }
  return urls;
}

/** Compatibilité : la seule carte de déplacement. */
export function refractionMapUrl(geometry: RefractionGeometry): string | null {
  return lensMapUrls(geometry)?.displacement ?? null;
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
  pixelRatio,
  strength,
  dispersion = 0,
  light,
}: RefractionFilterProps) {
  // Le cache de `lensMapUrls` tient lieu de mémo : une géométrie déjà vue ne
  // coûte qu'une recherche de clé.
  const urls = lensMapUrls({ width, height, radius, bezel, pixelRatio }, light);
  if (urls === null || width < 1 || height < 1) return null;

  // La carte encode ±1 sur ±127,5 : l'échelle vaut deux fois le décalage voulu.
  const scale = strength * 2;
  const passes =
    dispersion > 0 ? [scale * (1 + dispersion), scale, scale * (1 - dispersion)] : [scale];
  const image = (href: string, result: string) => (
    <feImage
      href={href}
      x="0"
      y="0"
      width={width}
      height={height}
      preserveAspectRatio="none"
      result={result}
    />
  );

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
          {image(urls.displacement, "map")}
          {passes.length === 1 ? (
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={passes[0]}
              xChannelSelector="R"
              yChannelSelector="G"
              result="lens"
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
              <feComposite in="c01" in2="c2" operator="arithmetic" k2="1" k3="1" result="lens" />
            </>
          )}
          {urls.specular !== null ? (
            <>
              {image(urls.specular, "light")}
              <feComposite in="light" in2="lens" operator="over" />
            </>
          ) : null}
        </filter>
      </defs>
    </svg>
  );
}

export const RefractionFilter = memo(RefractionFilterImpl);
