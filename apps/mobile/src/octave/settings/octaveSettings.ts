/**
 * Octave (mobile) — les réglages de l'APPAREIL d'Octave, les mêmes que ceux du bureau (mêmes clés, mêmes
 * défauts, lus par le partagé) : la page « Réglages d'Octave » les écrit, le lecteur, le hors ligne et la porte
 * de « Qui regarde ? » les lisent. Défauts de Damien (28/10) : transition douce allumée à 5 s, tenue à jour des
 * playlists gardées allumée, « ne pas demander le code PIN au démarrage » allumé — un défaut, jamais une
 * réécriture : une clé déjà écrite garde son choix.
 */

import { DEFAULT_OCTAVE_STARTUP, OCTAVE_STARTUP_KEY, parseOctaveStartup, type OctaveStartupChoice } from "@tentacle-tv/shared/octave/mode";
import {
  OCTAVE_AUTOSYNC_KEY,
  OCTAVE_LIQUID_GLASS_KEY,
  OCTAVE_SKIP_LAUNCH_PIN_KEY,
  OCTAVE_THEME_KEY,
  octaveAutoSyncOn,
  octaveLiquidGlassOf,
  octaveSkipLaunchPinOn,
  sanitizeOctaveTheme,
  type OctaveTheme,
} from "@tentacle-tv/shared/octave";
import { LIQUID_GLASS_STORAGE_KEY } from "../../theme/liquidGlass";
import { deviceSetting } from "./deviceSetting";

const onOffWrite = (on: boolean): string | null => (on ? null : "0");

/** « Tenir à jour les playlists gardées sur cet appareil » (le hors ligne d'Octave le lit). */
export const octaveAutoSync = deviceSetting<boolean>({ key: OCTAVE_AUTOSYNC_KEY, read: octaveAutoSyncOn, write: onOffWrite });

/** « Ne pas demander le code PIN au démarrage » (Octave seulement — la porte de « Qui regarde ? » le lit). */
export const octaveSkipLaunchPin = deviceSetting<boolean>({ key: OCTAVE_SKIP_LAUNCH_PIN_KEY, read: octaveSkipLaunchPinOn, write: onOffWrite });

/** « Au démarrage, ouvrir » : dernier mode, Octave, Tentacle. */
export const octaveStartup = deviceSetting<OctaveStartupChoice>({
  key: OCTAVE_STARTUP_KEY,
  read: parseOctaveStartup,
  write: (choice) => (choice === DEFAULT_OCTAVE_STARTUP ? null : choice),
});

/** « Apparence d'Octave » : comme Tentacle, clair, sombre. */
export const octaveTheme = deviceSetting<OctaveTheme>({ key: OCTAVE_THEME_KEY, read: sanitizeOctaveTheme, write: (theme) => theme });

/** « Liquid Glass dans Octave » : absent, la valeur de Tentacle (allumée par défaut, comme sa clé). */
export const octaveLiquidGlass = deviceSetting<boolean>({
  key: OCTAVE_LIQUID_GLASS_KEY,
  read: (raw, storage) => octaveLiquidGlassOf(raw, storage.getItem(LIQUID_GLASS_STORAGE_KEY) !== "false"),
  write: (on) => String(on),
});
