/**
 * Le pilote NVIDIA est-il chargé ? — ce que mpv doit savoir AVANT de créer son
 * périphérique Vulkan (`mpvBaseOptions.ts`, la file de calcul asynchrone).
 *
 * `/proc/driver/nvidia/version` n'existe qu'avec le module noyau de NVIDIA —
 * le fermé comme l'« open » qu'exigent les RTX 50 ; nouveau (et NVK par-dessus)
 * ne le crée pas. Sur un portable hybride, le fichier existe aussi : libplacebo
 * y préfère le GPU DÉDIÉ, donc c'est bien le périphérique NVIDIA que mpv crée.
 *
 * Lu une fois par processus : un pilote ne se charge pas en cours de route.
 */

import { existsSync } from "node:fs";

/** Le témoin du module noyau de NVIDIA. */
export const NVIDIA_DRIVER_WITNESS = "/proc/driver/nvidia/version";

/** Pure : le témoin existe-t-il ? `exists` est injecté pour les tests. */
export function detectNvidiaDriver(exists: (path: string) => boolean = existsSync): boolean {
  try {
    return exists(NVIDIA_DRIVER_WITNESS);
  } catch {
    return false;
  }
}

let detected: boolean | undefined;

/** Le verdict du processus, relevé au premier appel. */
export function nvidiaDriverLoaded(): boolean {
  detected ??= detectNvidiaDriver();
  return detected;
}
