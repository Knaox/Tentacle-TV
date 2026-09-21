/**
 * Les réglages D'APPAREIL du lecteur : le moteur vidéo, l'Atmos du système,
 * les sous-titres stylés par le lecteur avancé, la taille et la position des
 * sous-titres. Ils suivent l'appareil (un téléphone décode, l'autre pas), pas
 * le compte — d'où le stockage de l'application (clés `tentacle_*`, listées
 * dans `STORAGE_KEYS`), comme `deviceSettings.ts` du hors ligne.
 *
 * Amorcé par `configureEngineSettings(storage)` après l'hydratation ; sans
 * effet au chargement.
 */

import { useSyncExternalStore } from "react";
import type { StorageAdapter } from "@tentacle-tv/api-client";
import type { VideoEngineSetting } from "./types";

const ENGINE_KEY = "tentacle_video_engine";
const SYSTEM_ATMOS_KEY = "tentacle_prefer_system_atmos";
const STYLED_SUBTITLES_KEY = "tentacle_mpv_styled_subs";
const SUBTITLE_SCALE_KEY = "tentacle_sub_scale";
const SUBTITLE_POSITION_KEY = "tentacle_sub_pos";

export interface EngineSettings {
  engine: VideoEngineSetting;
  /** iOS : laisser le système décoder l'E-AC-3 Atmos (remux serveur accepté). */
  preferSystemAtmos: boolean;
  /** Android : un ASS choisi va au lecteur avancé. */
  styledSubtitlesViaMpv: boolean;
  /** Facteur d'échelle des sous-titres du lecteur avancé (1 = taille de la piste). */
  subtitleScale: number;
  /** Position verticale en pourcentage (100 = bas de l'image). */
  subtitlePosition: number;
}

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  engine: "auto",
  preferSystemAtmos: false,
  styledSubtitlesViaMpv: true,
  subtitleScale: 1,
  subtitlePosition: 100,
};

let storage: StorageAdapter | null = null;
let current: EngineSettings = DEFAULT_ENGINE_SETTINGS;
const listeners = new Set<() => void>();

const notify = (): void => {
  for (const listener of listeners) listener();
};

function readNumber(adapter: StorageAdapter, key: string, fallback: number, min: number, max: number): number {
  const raw = adapter.getItem(key);
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function read(adapter: StorageAdapter): EngineSettings {
  const engine = adapter.getItem(ENGINE_KEY);
  return {
    engine: engine === "native" || engine === "mpv" ? engine : "auto",
    preferSystemAtmos: adapter.getItem(SYSTEM_ATMOS_KEY) === "1",
    styledSubtitlesViaMpv: adapter.getItem(STYLED_SUBTITLES_KEY) !== "0",
    subtitleScale: readNumber(adapter, SUBTITLE_SCALE_KEY, 1, 0.5, 2),
    subtitlePosition: readNumber(adapter, SUBTITLE_POSITION_KEY, 100, 50, 100),
  };
}

export function configureEngineSettings(adapter: StorageAdapter): void {
  storage = adapter;
  current = read(adapter);
  notify();
}

export const getEngineSettings = (): EngineSettings => current;

export function setEngineSetting<K extends keyof EngineSettings>(key: K, value: EngineSettings[K]): void {
  if (current[key] === value) return;
  current = { ...current, [key]: value };
  switch (key) {
    case "engine":
      if (value === "auto") storage?.removeItem(ENGINE_KEY);
      else storage?.setItem(ENGINE_KEY, String(value));
      break;
    case "preferSystemAtmos":
      if (value) storage?.setItem(SYSTEM_ATMOS_KEY, "1");
      else storage?.removeItem(SYSTEM_ATMOS_KEY);
      break;
    case "styledSubtitlesViaMpv":
      if (value) storage?.removeItem(STYLED_SUBTITLES_KEY);
      else storage?.setItem(STYLED_SUBTITLES_KEY, "0");
      break;
    case "subtitleScale":
      storage?.setItem(SUBTITLE_SCALE_KEY, String(value));
      break;
    case "subtitlePosition":
      storage?.setItem(SUBTITLE_POSITION_KEY, String(value));
      break;
  }
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useEngineSettings(): EngineSettings {
  return useSyncExternalStore(subscribe, getEngineSettings, getEngineSettings);
}
