import { Dimensions } from "react-native";

/**
 * Mise à l'échelle responsive pour TV.
 *
 * Référence : 1080p (1920×1080 points logiques) — résolution logique d'Apple TV
 * (même sur 4K, l'UI est rendue en 1080p logique puis upscalée) et baseline
 * commune. Les box Android TV, elles, exposent des largeurs logiques variables
 * selon le modèle/la densité → une taille fixe en dp y paraît plus grande ou
 * plus petite. `scale()` convertit une dimension pensée pour 1080p en une valeur
 * qui occupe la MÊME proportion d'écran sur n'importe quel téléviseur.
 */
const BASE_WIDTH = 1920;
/** Garde-fous : on ne laisse pas le facteur dégénérer sur des valeurs aberrantes. */
const MIN_FACTOR = 0.5;
const MAX_FACTOR = 2;

export function scaleFactor(): number {
  const w = Dimensions.get("window").width || BASE_WIDTH;
  return Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, w / BASE_WIDTH));
}

/** Met à l'échelle une dimension conçue pour 1080p selon la largeur réelle de l'écran. */
export function scale(size: number): number {
  return Math.round(size * scaleFactor());
}
