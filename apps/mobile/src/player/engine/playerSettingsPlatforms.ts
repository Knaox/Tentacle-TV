import type { MobilePlatform, VideoEngineSetting } from "./types";

/**
 * Quels réglages du lecteur et de la lecture chaque plateforme affiche — la
 * SEULE source (Profil › Lecture › Lecteur). Règle de Damien : une option
 * Apple ne s'affiche pas sur Android, une option Android ne s'affiche pas sur
 * Apple, et un réglage sans effet ne s'affiche pas du tout. Pur, testé, sans
 * `Platform.OS` : l'écran passe la plateforme.
 */
export type PlayerSettingId =
  | "playbackMode"
  | "mediaLanguages"
  | "videoEngine"
  | "preferSystemAtmos"
  | "styledSubtitlesViaMpv"
  | "matchScreenFrameRate"
  | "subtitleScale"
  | "subtitlePosition";

interface PlayerSettingRule {
  platforms: readonly MobilePlatform[];
  /** N'a d'effet que si le lecteur avancé est dans cette build. */
  needsAdvancedEngine: boolean;
}

const BOTH: readonly MobilePlatform[] = ["ios", "android"];

export const PLAYER_SETTINGS: Readonly<Record<PlayerSettingId, PlayerSettingRule>> = {
  // Ce que le lecteur fait tout seul (passages) : suit le compte, partout.
  playbackMode: { platforms: BOTH, needsAdvancedEngine: false },
  // Langues audio et sous-titres par bibliothèque : suit le compte, partout.
  mediaLanguages: { platforms: BOTH, needsAdvancedEngine: false },
  // Les deux moteurs existent sur les deux plateformes (AVPlayer ou ExoPlayer,
  // et libmpv) : le choix a un sens partout où le lecteur avancé est livré.
  videoEngine: { platforms: BOTH, needsAdvancedEngine: true },
  // AVPlayer décode l'E-AC-3 Atmos pour l'audio spatial : Apple seulement
  // (le routeur Android ne lit pas ce réglage).
  preferSystemAtmos: { platforms: ["ios"], needsAdvancedEngine: true },
  // ExoPlayer rend l'ASS en texte simple ; sur iOS un ASS va déjà au lecteur
  // avancé (AVPlayer ne le lit pas) : Android seulement.
  styledSubtitlesViaMpv: { platforms: ["android"], needsAdvancedEngine: true },
  // Mode d'affichage de la fenêtre, pour les deux moteurs : Android seulement
  // (iOS règle seul la fréquence d'un écran ProMotion).
  matchScreenFrameRate: { platforms: ["android"], needsAdvancedEngine: false },
  // Les sous-titres dessinés par le lecteur avancé, sur les deux plateformes.
  subtitleScale: { platforms: BOTH, needsAdvancedEngine: true },
  subtitlePosition: { platforms: BOTH, needsAdvancedEngine: true },
};

export interface PlayerSettingsContext {
  platform: MobilePlatform;
  /** Le lecteur avancé est-il dans ce binaire (`isMpvAvailable`) ? */
  advancedEngine: boolean;
}

export function isPlayerSettingShown(id: PlayerSettingId, ctx: PlayerSettingsContext): boolean {
  const rule = PLAYER_SETTINGS[id];
  return rule.platforms.includes(ctx.platform) && (ctx.advancedEngine || !rule.needsAdvancedEngine);
}

/**
 * La phrase de chaque moteur, par plateforme : celles d'iOS parlent d'AirPlay,
 * du Dolby Vision profil 5 et de l'Atmos du système, qui n'existent pas sur
 * Android (espace i18n `preferences`).
 */
export const ENGINE_HINT_KEYS: Readonly<Record<MobilePlatform, Record<VideoEngineSetting, string>>> = {
  ios: { auto: "videoEngineAutoHint", native: "videoEngineSystemHint", mpv: "videoEngineAdvancedHint" },
  android: { auto: "videoEngineAutoHintAndroid", native: "videoEngineSystemHint", mpv: "videoEngineAdvancedHintAndroid" },
};
