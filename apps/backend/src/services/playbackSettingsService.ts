/**
 * Les réglages de lecture d'un compte, lus et écrits en base.
 *
 * Extrait de la route parce qu'il a un SECOND lecteur : Watch Together. Le
 * groupe suit les réglages de son hôte, et le serveur doit donc pouvoir les
 * lire sans passer par une requête HTTP de l'hôte lui-même.
 *
 * La normalisation vient du miroir `src/playback/playbackSettings.ts` (copie
 * stricte de @tentacle-tv/shared) : une colonne modifiée à la main en base
 * retombe sur son défaut au lieu de casser un lecteur.
 */

import { getPrisma } from "./db";
import {
  normalizePlaybackSettings,
  type PlaybackSettings,
} from "../playback/playbackSettings";

/** La ligne Prisma, à plat — le type suit le modèle `PlaybackSettings` du schéma. */
interface PlaybackSettingsRow {
  introAction: string;
  introCountdown: boolean;
  introDelayMs: number;
  outroAction: string;
  outroCountdown: boolean;
  outroDelayMs: number;
  recapAction: string;
  recapCountdown: boolean;
  recapDelayMs: number;
  previewAction: string;
  previewCountdown: boolean;
  previewDelayMs: number;
  nextCard: boolean;
  nextCountdown: boolean;
  nextAutoPlay: boolean;
  nextTrigger: string;
  nextBeforeEndSeconds: number;
  beforeEndEnabled: boolean;
  beforeEndMode: string;
  beforeEndValue: number;
  /** JSON des règles ciblées. Null = aucune (colonne ajoutée après coup). */
  beforeEndRules: string | null;
}

/** Les règles, relues sans faire confiance : un JSON illisible vaut « aucune ». */
function parseRules(raw: string | null): unknown {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Colonnes → objet imbriqué, passé par la normalisation (une colonne modifiée
 *  à la main en base retombe sur son défaut au lieu de casser un lecteur). */
export function rowToSettings(row: PlaybackSettingsRow): PlaybackSettings {
  return normalizePlaybackSettings({
    intro: { action: row.introAction, countdownVisible: row.introCountdown, autoDelayMs: row.introDelayMs },
    outro: { action: row.outroAction, countdownVisible: row.outroCountdown, autoDelayMs: row.outroDelayMs },
    recap: { action: row.recapAction, countdownVisible: row.recapCountdown, autoDelayMs: row.recapDelayMs },
    preview: {
      action: row.previewAction,
      countdownVisible: row.previewCountdown,
      autoDelayMs: row.previewDelayMs,
    },
    next: {
      nextCard: row.nextCard,
      nextCountdown: row.nextCountdown,
      nextAutoPlay: row.nextAutoPlay,
      nextTrigger: row.nextTrigger,
      // `nextBeforeEndSeconds` reste lu pour les lignes d'avant : la
      // normalisation le convertit en seuil quand aucun n'est enregistré.
      nextBeforeEndSeconds: row.nextBeforeEndSeconds,
      beforeEndEnabled: row.beforeEndEnabled,
      beforeEndDefault: { mode: row.beforeEndMode, value: row.beforeEndValue },
      beforeEndRules: parseRules(row.beforeEndRules),
    },
  });
}

export function settingsToColumns(settings: PlaybackSettings): PlaybackSettingsRow {
  return {
    introAction: settings.intro.action,
    introCountdown: settings.intro.countdownVisible,
    introDelayMs: settings.intro.autoDelayMs,
    outroAction: settings.outro.action,
    outroCountdown: settings.outro.countdownVisible,
    outroDelayMs: settings.outro.autoDelayMs,
    recapAction: settings.recap.action,
    recapCountdown: settings.recap.countdownVisible,
    recapDelayMs: settings.recap.autoDelayMs,
    previewAction: settings.preview.action,
    previewCountdown: settings.preview.countdownVisible,
    previewDelayMs: settings.preview.autoDelayMs,
    nextCard: settings.next.nextCard,
    nextCountdown: settings.next.nextCountdown,
    nextAutoPlay: settings.next.nextAutoPlay,
    nextTrigger: settings.next.nextTrigger,
    // Colonne héritée, plus lue par le contrat : on y recopie le seuil quand
    // il est en secondes, pour qu'un serveur d'avant reste cohérent.
    nextBeforeEndSeconds:
      settings.next.beforeEndDefault.mode === "seconds"
        ? settings.next.beforeEndDefault.value
        : 45,
    beforeEndEnabled: settings.next.beforeEndEnabled,
    beforeEndMode: settings.next.beforeEndDefault.mode,
    beforeEndValue: settings.next.beforeEndDefault.value,
    beforeEndRules: JSON.stringify(settings.next.beforeEndRules),
  };
}

/** Les réglages enregistrés d'un compte — `null` s'il n'a jamais rien réglé. */
export async function readPlaybackSettings(
  jellyfinUserId: string,
): Promise<PlaybackSettings | null> {
  const row = await getPrisma().playbackSettings.findUnique({ where: { jellyfinUserId } });
  return row ? rowToSettings(row) : null;
}
