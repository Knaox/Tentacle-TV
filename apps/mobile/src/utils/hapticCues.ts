import type { AndroidHaptics } from "expo-haptics";

/**
 * Les retours haptiques de l'app — UNE règle pour iOS et Android.
 *
 * Une vibration ne ponctue qu'une action VALIDÉE : un appui confirmé (au
 * relâcher), un appui long qui ouvre quelque chose, un choix posé, une issue.
 * Jamais au poser du doigt (`onPressIn`) : il se pose aussi pour faire défiler
 * une liste, et la carte qu'il touche n'est alors que présélectionnée.
 *
 * Chaque signal se dit par son INTENTION ; la plateforme le traduit dans son
 * propre vocabulaire. iOS : les générateurs d'UIKit (impact, sélection,
 * notification). Android : les constantes de `View.performHapticFeedback`,
 * qui suivent le réglage « Retour tactile » de l'appareil et ses effets
 * calibrés — jamais le `Vibrator` brut d'`impactAsync`, qui fait tourner le
 * moteur 50 ms, à pleine force sur un appareil sans contrôle d'amplitude.
 */
export type HapticCue =
  /** Un appui confirmé : bouton, carte, onglet, verdict d'un glisser. */
  | "tap"
  /** Un choix dans une série : segment, pas de curseur, note, interrupteur. */
  | "select"
  /** Un état durable qui change : Ma liste, favori, vu, une suppression. */
  | "commit"
  /** Un appui long qui ouvre une feuille ou un mode. */
  | "longPress"
  /** Un bouton de danger, confirmé. */
  | "destructive"
  /** Une opération aboutie. */
  | "success"
  /** Un message arrive — pas un geste de l'utilisateur. */
  | "notice";

/** Ce que joue iOS : les valeurs mêmes des énumérations d'expo-haptics. */
export type IosHaptic =
  | { kind: "impact"; style: "light" | "medium" | "heavy" }
  | { kind: "selection" }
  | { kind: "notification"; type: "success" };

/** Les valeurs de `AndroidHaptics` (« context-click »…), sans charger le module natif. */
export type AndroidHapticValue = `${AndroidHaptics}`;

const IOS: Record<HapticCue, IosHaptic> = {
  tap: { kind: "impact", style: "light" },
  select: { kind: "selection" },
  commit: { kind: "impact", style: "medium" },
  longPress: { kind: "impact", style: "medium" },
  destructive: { kind: "impact", style: "heavy" },
  success: { kind: "notification", type: "success" },
  notice: { kind: "impact", style: "light" },
};

/**
 * Niveaux d'API où apparaissent les constantes récentes. expo-haptics les lit
 * par réflexion et REJETTE celles que l'appareil ne connaît pas : en dessous,
 * l'équivalent le plus proche, présent depuis l'API 23 (le mobile en vise 26).
 */
const API_CONFIRM = 30;
const API_SEGMENT_TICK = 34;

/** iOS : l'effet joué pour un signal. */
export function iosHapticFor(cue: HapticCue): IosHaptic {
  return IOS[cue];
}

/**
 * Android : la constante système d'un signal, pour un niveau d'API donné.
 * Les effets suivent l'échelle d'iOS : léger → `EFFECT_TICK`, moyen →
 * `EFFECT_CLICK`, appui long → l'effet d'appui long du système.
 */
export function androidHapticFor(cue: HapticCue, apiLevel: number): AndroidHapticValue {
  switch (cue) {
    case "tap":
    case "notice":
      return "context-click";
    case "select":
      return apiLevel >= API_SEGMENT_TICK ? "segment-tick" : "clock-tick";
    case "longPress":
      return "long-press";
    case "commit":
    case "destructive":
    case "success":
      return apiLevel >= API_CONFIRM ? "confirm" : "virtual-key";
  }
}
