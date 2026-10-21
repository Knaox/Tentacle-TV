/**
 * Le « liquide » du Liquid Glass : ressorts, lentille, reflet qui suit le
 * pointeur, fusion et métamorphose des formes, accessibilité du système,
 * contraste. Règles pures + petites briques ; la feuille est `physics.css`.
 */

export * from "./springs";
export * from "./specular";
export * from "./fusion";
export * from "./accessibility";
export * from "./contrast";
export * from "./glassMotion";
export { useSpecularHighlight } from "./useSpecularHighlight";
export { GlassSpecular, GLASS_LENS_PROPS } from "./GlassSpecular";
export { GlassFusion, type GlassFusionProps } from "./GlassFusion";
