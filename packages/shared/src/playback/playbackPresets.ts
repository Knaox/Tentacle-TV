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
 * Le mode « Par défaut » n'est pas un troisième goût : c'est LE jeu de valeurs
 * livré (`DEFAULT_PLAYBACK_SETTINGS` le recopie). Un compte qui n'a jamais
 * rien réglé s'y trouve donc sans avoir rien fait, et l'étiquette le lui dit.
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
  BEFORE_END_DEFAULT,
  NEXT_COUNTDOWN_DEFAULT_MS,
  SEGMENT_AUTO_DELAY_DEFAULT_MS,
  type NextEpisodeSettings,
  type PlaybackSettings,
} from "./playbackSettings";

export type PlaybackPreset = "default" | "manual" | "automatic" | "custom";

/** Les modes qu'on peut CHOISIR — « personnalisé » ne s'écrit pas. */
export const SELECTABLE_PRESETS: readonly Exclude<PlaybackPreset, "custom">[] = [
  "default",
  "manual",
  "automatic",
];

const delay = SEGMENT_AUTO_DELAY_DEFAULT_MS;

/** Le repli temporel, identique dans les trois modes : il ne les distingue pas. */
const beforeEnd: Pick<
  NextEpisodeSettings,
  "beforeEndEnabled" | "beforeEndDefault" | "beforeEndRules"
> = {
  beforeEndEnabled: true,
  beforeEndDefault: { ...BEFORE_END_DEFAULT },
  beforeEndRules: [],
};

/**
 * MANUEL : le lecteur propose, il n'agit jamais seul. La fiche « à suivre »
 * reste — c'est une proposition, pas un acte — mais elle ne décompte pas et
 * n'enchaîne pas.
 */
/**
 * PAR DÉFAUT : ce que le lecteur fait sans qu'on lui ait rien demandé.
 *
 * Le début d'épisode et l'aperçu du suivant se passent seuls — ce sont les
 * deux passages qu'on a déjà vus, et le décompte les rend réfutables. Le
 * résumé et le générique de fin se PROPOSENT : sauter un « précédemment »
 * d'office prive d'un rappel utile, et sauter un générique d'office prive
 * d'une scène post-générique.
 */
const DEFAULT: PlaybackSettings = {
  intro: { action: "auto", countdownVisible: true, autoDelayMs: delay },
  outro: { action: "button", countdownVisible: true, autoDelayMs: delay },
  outroFilm: { action: "auto", countdownVisible: true, autoDelayMs: delay },
  recap: { action: "button", countdownVisible: true, autoDelayMs: delay },
  preview: { action: "auto", countdownVisible: true, autoDelayMs: delay },
  next: {
    nextCard: true,
    nextCountdown: true,
    nextCountdownMs: NEXT_COUNTDOWN_DEFAULT_MS,
    nextAutoPlay: true,
    nextTrigger: "outroStart",
    ...beforeEnd,
  },
};

const MANUAL: PlaybackSettings = {
  intro: { action: "button", countdownVisible: true, autoDelayMs: delay },
  outro: { action: "button", countdownVisible: true, autoDelayMs: delay },
  outroFilm: { action: "button", countdownVisible: true, autoDelayMs: delay },
  recap: { action: "button", countdownVisible: true, autoDelayMs: delay },
  preview: { action: "button", countdownVisible: true, autoDelayMs: delay },
  next: {
    nextCard: true,
    nextCountdown: false,
    nextCountdownMs: NEXT_COUNTDOWN_DEFAULT_MS,
    nextAutoPlay: false,
    nextTrigger: "outroStart",
    ...beforeEnd,
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
  outroFilm: { action: "auto", countdownVisible: true, autoDelayMs: delay },
  recap: { action: "auto", countdownVisible: true, autoDelayMs: delay },
  preview: { action: "auto", countdownVisible: true, autoDelayMs: delay },
  next: {
    nextCard: true,
    nextCountdown: true,
    nextCountdownMs: NEXT_COUNTDOWN_DEFAULT_MS,
    nextAutoPlay: true,
    nextTrigger: "outroStart",
    ...beforeEnd,
  },
};

export type SelectablePreset = Exclude<PlaybackPreset, "custom">;

export const PLAYBACK_PRESETS: Readonly<Record<SelectablePreset, PlaybackSettings>> = {
  default: DEFAULT,
  manual: MANUAL,
  automatic: AUTOMATIC,
};

/** Les réglages complets d'un mode — à écrire tels quels. */
export function presetSettings(preset: SelectablePreset): PlaybackSettings {
  return structuredCloneSettings(PLAYBACK_PRESETS[preset]);
}

/** Copie profonde sans `structuredClone` : shared ne suppose aucun runtime. */
function structuredCloneSettings(settings: PlaybackSettings): PlaybackSettings {
  return {
    intro: { ...settings.intro },
    outro: { ...settings.outro },
    outroFilm: { ...settings.outroFilm },
    recap: { ...settings.recap },
    preview: { ...settings.preview },
    next: {
      ...settings.next,
      beforeEndDefault: { ...settings.next.beforeEndDefault },
      beforeEndRules: settings.next.beforeEndRules.map((rule) => ({
        ...rule,
        libraryIds: [...rule.libraryIds],
      })),
    },
  };
}

/**
 * Les clés i18n de chaque mode — ici, et pas dans chaque interface.
 *
 * Les quatre surfaces listaient leurs options à la main, et l'ajout de « Par
 * défaut » n'en a atteint aucune : un compte neuf se retrouvait sur un mode
 * qu'aucun bouton ne portait, donc sans aucune option cochée, sous une aide
 * qui lui annonçait des réglages « personnalisés ». Dériver la liste d'ici
 * rend cette dérive impossible.
 *
 * ⚠️ Ce sont des CLÉS i18n, pas des identifiants : les renommer casse
 * l'affichage en silence.
 */
export const PRESET_LABEL_KEYS: Readonly<Record<PlaybackPreset, string>> = {
  default: "playbackModeDefault",
  manual: "playbackModeManual",
  automatic: "playbackModeAutomatic",
  custom: "playbackModeCustom",
};

export const PRESET_HINT_KEYS: Readonly<Record<PlaybackPreset, string>> = {
  default: "playbackModeDefaultHint",
  manual: "playbackModeManualHint",
  automatic: "playbackModeAutomaticHint",
  custom: "playbackModeCustomHint",
};

/**
 * Quel mode décrit ces réglages ? `custom` dès qu'un seul champ s'écarte —
 * y compris un délai, sans quoi l'étiquette mentirait sur ce qui va se passer.
 */
/**
 * ⚠️ La comparaison est un `JSON.stringify` : l'ORDRE DES CLÉS compte. Un champ
 * ajouté aux préréglages doit l'être à la MÊME place que dans
 * `normalizePlaybackSettings` — sinon des réglages identiques se lisent
 * « personnalisé », et le mode choisi ne se coche plus. Éprouvé : le seul ajout
 * de `nextCountdownMs` par un spread en fin d'objet a suffi à casser les trois
 * modes.
 */
export function detectPreset(settings: PlaybackSettings): PlaybackPreset {
  for (const preset of SELECTABLE_PRESETS) {
    if (JSON.stringify(settings) === JSON.stringify(PLAYBACK_PRESETS[preset])) return preset;
  }
  return "custom";
}
