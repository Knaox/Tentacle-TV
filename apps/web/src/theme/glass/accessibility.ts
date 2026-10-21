/**
 * Accessibilité du verre — les réglages du SYSTÈME, appliqués comme Apple.
 *
 * Trois réglages de macOS (Réglages Système › Accessibilité › Affichage),
 * relayés tels quels par Chromium en media queries — mesuré dans Electron 43
 * (Chromium 150) : `prefers-reduced-transparency`, `prefers-contrast`,
 * `prefers-reduced-motion` y sont tous reconnus. Aucun pont natif n'est donc
 * nécessaire, et la même règle vaut pour le web.
 *
 * Ce que fait Apple, et donc ce que fait le verre ici :
 *  - Réduire la transparence → le verre devient GIVRÉ : surface opaque à la
 *    teinte du verre, plus de flou ni de réfraction (rien ne transparaît) ;
 *  - Contraste accru → surface plus opaque, liseré net et contrasté, aucun
 *    reflet décoratif ;
 *  - Réduire les animations → ni lentille, ni rebond, ni reflet qui suit :
 *    les changements d'état passent en fondu.
 *
 * Tout passe par des attributs sur `<html>` lus par `physics.css` et par les
 * crochets — jamais une condition recopiée dans un composant.
 */

export interface SystemAccessibility {
  reduceTransparency: boolean;
  increaseContrast: boolean;
  reduceMotion: boolean;
}

/** Ce que le verre rend effectivement. */
export type GlassMaterial = "liquid" | "frosted" | "solid";

export interface GlassAccessibilityPlan {
  material: GlassMaterial;
  /** Reflet qui suit le pointeur. */
  specularFollow: boolean;
  /** Lentille (grossissement) et rebond à ressort. */
  lens: boolean;
  /** Fusion et métamorphose des formes ; sinon fondu enchaîné. */
  morph: boolean;
  /** Attributs à poser sur `<html>` (absents = valeur par défaut). */
  attributes: Record<
    "data-lg-transparency" | "data-lg-contrast" | "data-lg-motion" | "data-lg-material",
    string | null
  >;
}

/**
 * La règle. Le contraste accru l'emporte sur la transparence réduite pour le
 * matériau (`solid` : opaque ET liseré net), comme dans macOS où les deux
 * cumulés donnent la surface la plus lisible.
 */
export function planGlassAccessibility(a: SystemAccessibility): GlassAccessibilityPlan {
  const material: GlassMaterial = a.increaseContrast ? "solid" : a.reduceTransparency ? "frosted" : "liquid";
  const still = a.reduceMotion;
  return {
    material,
    specularFollow: material === "liquid" && !still,
    lens: !still,
    morph: !still,
    attributes: {
      "data-lg-transparency": a.reduceTransparency ? "reduce" : null,
      "data-lg-contrast": a.increaseContrast ? "more" : null,
      "data-lg-motion": still ? "reduce" : null,
      // Le matériau à rendre, quand ce n'est plus le verre : `physics.css` le lit.
      "data-lg-material": material === "liquid" ? null : material,
    },
  };
}

export const ACCESSIBILITY_QUERIES = {
  reduceTransparency: "(prefers-reduced-transparency: reduce)",
  increaseContrast: "(prefers-contrast: more)",
  reduceMotion: "(prefers-reduced-motion: reduce)",
} as const satisfies Record<keyof SystemAccessibility, string>;

type MatchMedia = (query: string) => Pick<MediaQueryList, "matches" | "addEventListener" | "removeEventListener">;

/** Lecture des trois réglages ; sans `matchMedia`, aucun n'est demandé. */
export function readSystemAccessibility(matchMedia: MatchMedia | undefined): SystemAccessibility {
  const q = (s: string) => (matchMedia ? matchMedia(s).matches : false);
  return {
    reduceTransparency: q(ACCESSIBILITY_QUERIES.reduceTransparency),
    increaseContrast: q(ACCESSIBILITY_QUERIES.increaseContrast),
    reduceMotion: q(ACCESSIBILITY_QUERIES.reduceMotion),
  };
}

let current: GlassAccessibilityPlan = planGlassAccessibility({
  reduceTransparency: false,
  increaseContrast: false,
  reduceMotion: false,
});

/** Le plan en vigueur (dernier appliqué par `installGlassAccessibility`). */
export const getGlassAccessibility = (): GlassAccessibilityPlan => current;

/**
 * Pose les attributs sur `root` et les tient à jour quand l'utilisateur change
 * un réglage du système, application ouverte. Retourne de quoi se désabonner.
 * À appeler UNE fois, au démarrage, avant le premier rendu (pas d'éclair de
 * verre transparent chez qui l'a réduite).
 */
export function installGlassAccessibility(
  root: HTMLElement = document.documentElement,
  matchMedia: MatchMedia | undefined = typeof window !== "undefined" ? window.matchMedia?.bind(window) : undefined,
): () => void {
  const apply = () => {
    current = planGlassAccessibility(readSystemAccessibility(matchMedia));
    for (const [name, value] of Object.entries(current.attributes)) {
      if (value === null) root.removeAttribute(name);
      else root.setAttribute(name, value);
    }
  };
  apply();
  if (!matchMedia) return () => undefined;
  const lists = Object.values(ACCESSIBILITY_QUERIES).map((q) => matchMedia(q));
  for (const l of lists) l.addEventListener("change", apply);
  return () => {
    for (const l of lists) l.removeEventListener("change", apply);
  };
}
