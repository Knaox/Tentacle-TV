/**
 * Les tâches de fond de la recherche : l'index construit peu après le
 * démarrage — pour que la première recherche ne tombe pas sur le repli — et
 * les droits des comptes que personne n'a lus depuis un jour, rendus à la
 * mémoire.
 */

import { prewarmSearchCatalog } from "./catalog";
import { sweepUserAccess } from "./userAccess";

/** Le temps que la base, Jellyfin et les autres démarrages se posent. */
const BOOT_DELAY_MS = 20_000;
const SWEEP_INTERVAL_MS = 3600_000;

let bootTimer: NodeJS.Timeout | null = null;
let sweepTimer: NodeJS.Timeout | null = null;

export function startSearchJobs(): void {
  if (sweepTimer !== null) return;
  bootTimer = setTimeout(() => {
    bootTimer = null;
    void prewarmSearchCatalog();
  }, BOOT_DELAY_MS);
  sweepTimer = setInterval(() => void sweepUserAccess(), SWEEP_INTERVAL_MS);
}

export function stopSearchJobs(): void {
  if (bootTimer !== null) clearTimeout(bootTimer);
  if (sweepTimer !== null) clearInterval(sweepTimer);
  bootTimer = null;
  sweepTimer = null;
}
