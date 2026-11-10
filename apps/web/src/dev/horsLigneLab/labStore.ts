/**
 * L'état FACTICE de la machine, pour le labo du hors ligne : ce que le « moteur » garde (la
 * liste des fichiers), l'espace du disque, et ce que le « serveur » répondrait à une mise en
 * file. Le pont factice du banc (`bench/hors-ligne/fakeBridge.ts`) répond d'ici ; le labo y
 * écrit ses scénarios. Rien de tout cela n'existe dans un paquet livré.
 */

import type { MediaItem } from "@tentacle-tv/shared";
import type { DownloadListEntry } from "@tentacle-tv/offline-core";

export interface LabMachine {
  entries: DownloadListEntry[];
  freeBytes: number;
  usedBytes: number;
  /** La prochaine mise en file est REFUSÉE faute d'espace (octets demandés), sinon acceptée. */
  refuseEnqueue: number | null;
  /** Les instantanés du disque : `item.json` et `series.json`, par titre. */
  snapshots: Record<string, { item?: MediaItem; series?: MediaItem }>;
}

const GIB = 1024 ** 3;

export const labMachine: LabMachine = {
  entries: [],
  freeBytes: 184 * GIB,
  usedBytes: 0,
  refuseEnqueue: null,
  snapshots: {},
};

/** Le pont factice se signale : sans lui, le labo ne monte rien (il toucherait la vraie machine). */
export const LAB_BRIDGE_MARK = "__horsLigneLab";

export function labBridgePresent(): boolean {
  const bridge = (window as unknown as { tentacle?: Record<string, unknown> }).tentacle;
  return bridge?.[LAB_BRIDGE_MARK] === true;
}
