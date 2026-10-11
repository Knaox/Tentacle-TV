/**
 * Les réglages de l'app que le PAQUET fixe (`apps/server-windows/host-options.json`,
 * facultatif), et non l'utilisateur :
 *
 *  - `jellyfinInstaller` (défaut `true`) : l'installation guidée de Jellyfin.
 *    Le Store pourrait refuser qu'une app télécharge et lance un autre
 *    logiciel (règle 10.1.5) : `false` la coupe, et l'assistant ne garde que
 *    le repli « ouvrir jellyfin.org, puis détecter ».
 *
 * Un fichier absent ou illisible vaut les défauts.
 */
import { readFileSync } from "node:fs";

export interface HostOptions {
  jellyfinInstaller: boolean;
}

export const DEFAULT_HOST_OPTIONS: HostOptions = { jellyfinInstaller: true };

export function parseHostOptions(text: string | null): HostOptions {
  if (text === null) return DEFAULT_HOST_OPTIONS;
  try {
    const raw = JSON.parse(text) as { jellyfinInstaller?: unknown };
    return { jellyfinInstaller: raw.jellyfinInstaller !== false };
  } catch {
    return DEFAULT_HOST_OPTIONS;
  }
}

export function readHostOptions(path: string): HostOptions {
  try {
    return parseHostOptions(readFileSync(path, "utf8"));
  } catch {
    return DEFAULT_HOST_OPTIONS;
  }
}
