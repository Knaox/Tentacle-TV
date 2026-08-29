/**
 * Trois façons de régler la lecture, au lieu de vingt contrôles.
 *
 * # Pourquoi
 *
 * La refonte des segments a exposé quatre passages × trois réglages, plus cinq
 * réglages d'épisode suivant — dont un délai en millisecondes brutes. Chacun
 * est justifié pris isolément ; ensemble ils forment un tableau de bord que
 * personne n'a envie de traverser pour dire « passe-moi les intros ». Les deux
 * seules intentions courantes tiennent en deux mots : je veux qu'on me
 * PROPOSE, ou je veux que ça se FASSE. Le reste est du réglage fin, et le
 * réglage fin se mérite — il vit derrière un repli, sur grand écran.
 *
 * # Ce que « personnalisé » veut dire
 *
 * Rien. Ce n'est pas un mode, c'est un constat : les réglages ne
 * correspondent à aucun des deux autres. On ne l'écrit jamais, on le LIT.
 *
 * Pur et testé, parce que cinq interfaces vont s'en servir et qu'aucune ne
 * doit pouvoir en donner sa propre version.
 */

import {
  DEFAULT_PLAYBACK_SETTINGS,
  SEGMENT_AUTO_DELAY_DEFAULT_MS,
  type PlaybackSettings,
} from "./playbackSettings";

export type PlaybackPreset = "manual" | "automatic" | "custom";

/** Les modes qu'on peut CHOISIR — « personnalisé » ne s'écrit pas. */
export const SELECTABLE_PRESETS: readonly Exclude<PlaybackPreset, "custom">[] = [
  "manual",
  "automatic",
];

const delay = SEGMENT_AUTO_DELAY_DEFAULT_MS;

/**
 * MANUEL : le lecteur propose, il n'agit jamais seul. La fiche « à suivre »
 * reste — c'est une proposition, pas un acte — mais elle ne décompte pas et
 * n'enchaîne pas.
 */
const MANUAL: PlaybackSettings = {
  intro: { action: "button", countdownVisible: true, autoDelayMs: delay },
  outro: { action: "button", countdownVisible: true, autoDelayMs: delay },
  recap: { action: "button", countdownVisible: true, autoDelayMs: delay },
  preview: { action: "button", countdownVisible: true, autoDelayMs: delay },
  next: {
    nextCard: true,
    nextCountdown: false,
    nextAutoPlay: false,
    nextTrigger: "outroStart",
    nextBeforeEndSeconds: DEFAULT_PLAYBACK_SETTINGS.next.nextBeforeEndSeconds,
  },
};

/**
 * AUTOMATIQUE : le lecteur fait le travail. Les quatre passages se passent
 * seuls après le délai, et l'épisode suivant s'enchaîne.
 *
 * Le générique y est « auto » lui aussi, mais cela ne peut jamais fermer un
 * film : l'arbitre impose le bouton dès que « passer » voudrait dire quitter
 * la lecture (`overlayArbiter.ts`). En automatique, le générique ne sert donc
 * qu'à rejoindre une scène post-générique.
 */
const AUTOMATIC: PlaybackSettings = {
  intro: { action: "auto", countdownVisible: true, autoDelayMs: delay },
  outro: { action: "auto", countdownVisible: true, autoDelayMs: delay },
  recap: { action: "auto", countdownVisible: true, autoDelayMs: delay },
  preview: { action: "auto", countdownVisible: true, autoDelayMs: delay },
  next: {
    nextCard: true,
    nextCountdown: true,
    nextAutoPlay: true,
    nextTrigger: "outroStart",
    nextBeforeEndSeconds: DEFAULT_PLAYBACK_SETTINGS.next.nextBeforeEndSeconds,
  },
};

export const PLAYBACK_PRESETS: Readonly<Record<"manual" | "automatic", PlaybackSettings>> = {
  manual: MANUAL,
  automatic: AUTOMATIC,
};

/** Les réglages complets d'un mode — à écrire tels quels. */
export function presetSettings(preset: "manual" | "automatic"): PlaybackSettings {
  return structuredCloneSettings(PLAYBACK_PRESETS[preset]);
}

/** Copie profonde sans `structuredClone` : shared ne suppose aucun runtime. */
function structuredCloneSettings(settings: PlaybackSettings): PlaybackSettings {
  return {
    intro: { ...settings.intro },
    outro: { ...settings.outro },
    recap: { ...settings.recap },
    preview: { ...settings.preview },
    next: { ...settings.next },
  };
}

/**
 * Quel mode décrit ces réglages ? `custom` dès qu'un seul champ s'écarte —
 * y compris un délai, sans quoi l'étiquette mentirait sur ce qui va se passer.
 */
export function detectPreset(settings: PlaybackSettings): PlaybackPreset {
  for (const preset of SELECTABLE_PRESETS) {
    if (JSON.stringify(settings) === JSON.stringify(PLAYBACK_PRESETS[preset])) return preset;
  }
  return "custom";
}
