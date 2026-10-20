/**
 * Les réglages D'APPAREIL de l'ouverture du démarrage : « Animation
 * d'ouverture » et « Son au démarrage », allumés par défaut (seul « 0 » est
 * écrit). Ils suivent l'appareil, pas le compte : un téléphone qu'on ouvre en
 * réunion n'est pas la tablette du salon. Clés `tentacle_*`, listées dans
 * `STORAGE_KEYS` ; le catalogue des réglages les rend (Réglages › Lecture et
 * apparence › Sur cet appareil).
 *
 * L'ouverture se décide AVANT l'hydratation du stockage : `readBootIntroSettings`
 * lit le disque directement. Ensuite, `configureBootIntroSettings(storage)`
 * amorce le magasin que lisent les écrans de réglages.
 */

import { useCallback, useSyncExternalStore } from "react";
import type { StorageAdapter } from "@tentacle-tv/api-client";

export const BOOT_INTRO_KEY = "tentacle_boot_intro";
export const BOOT_SOUND_KEY = "tentacle_boot_sound";

export interface BootIntroSettings {
  /** L'animation d'ouverture se joue au démarrage à froid. */
  intro: boolean;
  /** Le « ta-dum » l'accompagne (jamais sans l'animation). */
  sound: boolean;
}

export const DEFAULT_BOOT_INTRO_SETTINGS: BootIntroSettings = { intro: true, sound: true };

/** Une valeur stockée : seul « 0 » coupe ; absente ou illisible, allumée. */
export const settingOn = (raw: string | null | undefined): boolean => raw !== "0";

const KEYS: Record<keyof BootIntroSettings, string> = { intro: BOOT_INTRO_KEY, sound: BOOT_SOUND_KEY };

let storage: StorageAdapter | null = null;
let current: BootIntroSettings = DEFAULT_BOOT_INTRO_SETTINGS;
const listeners = new Set<() => void>();

const notify = (): void => {
  for (const listener of listeners) listener();
};

/** Le démarrage, avant le stockage : le disque lu directement (allumés si la lecture échoue). */
export async function readBootIntroSettings(read: (key: string) => Promise<string | null>): Promise<BootIntroSettings> {
  const [intro, sound] = await Promise.all([read(BOOT_INTRO_KEY).catch(() => null), read(BOOT_SOUND_KEY).catch(() => null)]);
  return { intro: settingOn(intro), sound: settingOn(sound) };
}

export function configureBootIntroSettings(adapter: StorageAdapter): void {
  storage = adapter;
  current = { intro: settingOn(adapter.getItem(BOOT_INTRO_KEY)), sound: settingOn(adapter.getItem(BOOT_SOUND_KEY)) };
  notify();
}

export const getBootIntroSettings = (): BootIntroSettings => current;

export function setBootIntroSetting(key: keyof BootIntroSettings, value: boolean): void {
  if (current[key] === value) return;
  current = { ...current, [key]: value };
  if (value) storage?.removeItem(KEYS[key]);
  else storage?.setItem(KEYS[key], "0");
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useBootIntroSettings(): BootIntroSettings {
  return useSyncExternalStore(subscribe, getBootIntroSettings, getBootIntroSettings);
}

/** « Animation d'ouverture » : la valeur et son interrupteur. */
export function useBootIntroSetting(): [boolean, (next: boolean) => void] {
  const { intro } = useBootIntroSettings();
  return [intro, useCallback((next: boolean) => setBootIntroSetting("intro", next), [])];
}

/** « Son au démarrage » : la valeur et son interrupteur (sans effet si l'animation est coupée). */
export function useBootSoundSetting(): [boolean, (next: boolean) => void] {
  const { sound } = useBootIntroSettings();
  return [sound, useCallback((next: boolean) => setBootIntroSetting("sound", next), [])];
}
