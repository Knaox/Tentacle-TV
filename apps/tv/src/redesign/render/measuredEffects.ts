import { NativeModules } from "react-native";

/**
 * Les INTERRUPTEURS DE MESURE des effets (lot Lite, L1) : couper un effet,
 * un seul, pour mesurer ce qu'il coûte sur l'appareil. Lus une fois au
 * chargement, dans la constante `effectsOff` du module natif `TentaclePerf`,
 * que seule l'app de MESURE (`-PtentaclePerfApp=1`, paquet `….perf`)
 * remplit (`PerfConfig.effectsOff`) — dans l'app livrée, rien n'est jamais
 * coupé.
 *
 *   adb shell setprop debug.tentacle.fx blur,shadows   puis relancer l'app de mesure
 *
 * Le jumeau de l'Apple TV (`measuredEffects.ios.ts`) ne coupe rien.
 * Jamais un réglage, jamais une version allégée : une mesure. Le mode Lite
 * aura ses propres équivalents, sobres (`docs/android-tv-lite/BASELINE.md`).
 */
export type MeasuredEffect =
  /** les flous : halos d'œuvre, ombres floutées, flous SVG */
  | "blur"
  /** le verre dessiné (surfaces de verre, pilules, panneaux) */
  | "glass"
  /** les ombres portées (masques précalculés) */
  | "shadows"
  /** les dégradés (voiles, fondus de bord, dégradés des boutons) */
  | "gradients"
  /** le fond vivant : lumières, halo ambiant et leur fondu au focus */
  | "ambient"
  /** l'habit du focus d'une carte : agrandissement et ombre */
  | "focusScale"
  /** le mouvement de la refonte (ressorts, fondus de Reanimated) */
  | "motion"
  /** le fondu entre deux pages */
  | "pageFade"
  /** la rotation du héros (fondu de l'image, du halo, du texte, toutes les
   *  8 s). Aucune bande-annonce ne se lit d'elle-même dans l'app (relevé du
   *  07/10) : rien d'autre à couper de ce côté. */
  | "heroRotation";

const native = NativeModules.TentaclePerf as { effectsOff?: string } | undefined;
const OFF: ReadonlySet<string> = new Set((native?.effectsOff ?? "").split(",").filter(Boolean));

/** Vrai quand l'effet est coupé pour la mesure (app de mesure seulement). */
export function effectOff(name: MeasuredEffect): boolean {
  return OFF.has(name);
}
