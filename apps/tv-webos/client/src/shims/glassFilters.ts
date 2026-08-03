/**
 * Filtre SVG de réfraction du verre, retiré.
 *
 * `GlassSurface` et `Modal` composent un `backdrop-filter` avec un filtre SVG
 * (`feImage` + trois `feDisplacementMap`) pour donner au verre son effet de
 * réfraction. Le flou d'arrière-plan n'arrive qu'à Chrome 76 alors que le
 * socle est Chrome 53 : le filtre n'aurait rien à réfracter, et le
 * `feDisplacementMap` resterait une passe de composition payée pour rien.
 *
 * `resolveGlassLevel` répond déjà `flat` sur ce moteur — ce module ne fait que
 * retirer du bundle le filtre lui-même et son image encodée.
 */

export const GLASS_FILTER_ID = "tentacle-glass-refract";

export function GlassFilters(): null {
  return null;
}
