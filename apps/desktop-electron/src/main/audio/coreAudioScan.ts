/**
 * Le RECENSEMENT des composants audio de macOS, fait au lancement du bureau,
 * hors du fil principal — et jamais au premier clic.
 *
 * # Ce que coûte le froid, mesuré (lot Sillon vitesse, S5, 2026-10-24)
 *
 * Le premier `AudioComponentFindNext` d'un processus, cache système froid :
 * **1 996 ms** (puis 6 ms dans les processus suivants). Rien d'autre n'est
 * lent : création de l'unité ~50 ms, `AudioUnitInitialize` ~3 ms. C'est le
 * palier de ~2 s que mpv payait au premier titre (`outputWarmup.ts`).
 *
 * Le préchauffage de la sortie ne se joue qu'à la naissance du moteur, c'est-à-
 * dire à l'entrée dans Octave : un clic dans les ~2 s qui suivent attendait le
 * recensement (banc de S8 : 1er clic de bibliothèque à 1 854 ms). Fait ici, au
 * lancement, il est payé pendant que l'application démarre.
 *
 * # Sans effet visible
 *
 * Seul `AudioComponentFindNext` est appelé : aucune unité créée, aucun
 * périphérique ouvert, aucun son — un casque Bluetooth ne se réveille pas.
 * L'appel passe par le pool de libuv (`koffi` asynchrone) : le fil principal
 * n'attend jamais, même 2 s. Une panne ne fait rien : mpv recensera lui-même,
 * comme avant.
 */

import koffi from "koffi";
import type { Platform } from "./audioOptions";

const AUDIO_TOOLBOX = "/System/Library/Frameworks/AudioToolbox.framework/AudioToolbox";

/** `'auou'`, `'def '`, `'appl'` : la sortie par défaut d'Apple, celle qu'ouvre mpv. */
export function fourcc(code: string): number {
  return [...code].reduce((acc, c) => ((acc << 8) | c.charCodeAt(0)) >>> 0, 0);
}

export interface ScanDescription {
  componentType: number;
  componentSubType: number;
  componentManufacturer: number;
  componentFlags: number;
  componentFlagsMask: number;
}

export const DEFAULT_OUTPUT: ScanDescription = {
  componentType: fourcc("auou"),
  componentSubType: fourcc("def "),
  componentManufacturer: fourcc("appl"),
  componentFlags: 0,
  componentFlagsMask: 0,
};

/** La recherche native, ASYNCHRONE ; `done` reçoit la durée (ms) ou l'erreur. */
export type FindNextAsync = (description: ScanDescription, done: (error: unknown) => void) => void;

function nativeFindNext(): FindNextAsync {
  const lib = koffi.load(AUDIO_TOOLBOX);
  koffi.struct("AudioComponentDescription", {
    componentType: "uint32",
    componentSubType: "uint32",
    componentManufacturer: "uint32",
    componentFlags: "uint32",
    componentFlagsMask: "uint32",
  });
  const findNext = lib.func("void* AudioComponentFindNext(void*, AudioComponentDescription*)");
  return (description, done) => findNext.async(null, description, (error: unknown) => done(error));
}

let started = false;

/**
 * Lance le recensement une fois par processus (macOS seulement). Ne bloque
 * jamais et ne lève jamais ; `onDone` (journal de développement, tests) reçoit
 * sa durée, ou `null` s'il n'a pas pu se faire.
 */
export function scanAudioComponents(
  platform: Platform,
  onDone: (ms: number | null) => void = () => undefined,
  load: () => FindNextAsync = nativeFindNext,
  now: () => number = () => performance.now(),
): boolean {
  if (platform !== "darwin" || started) return false;
  started = true;
  const t0 = now();
  try {
    load()(DEFAULT_OUTPUT, (error) => onDone(error ? null : now() - t0));
  } catch {
    onDone(null);
  }
  return true;
}

/** Tests seulement : un nouveau « processus ». */
export function resetScanForTests(): void {
  started = false;
}
