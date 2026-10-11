/**
 * L'état propre à l'hôte, dans `host.json` du dossier de données : le port
 * choisi, et si l'assistant a déjà été ouvert une fois.
 *
 * Lecture TOLÉRANTE : un fichier abîmé ou d'une autre version rend les
 * défauts champ par champ, jamais une erreur au démarrage.
 */
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { DEFAULT_PORT, isValidPort } from "../net/ports";

export interface HostState {
  port: number;
  /** L'assistant ne s'ouvre qu'UNE fois, au premier démarrage réussi. */
  wizardOpened: boolean;
}

export const DEFAULT_STATE: HostState = { port: DEFAULT_PORT, wizardOpened: false };

export function parseHostState(raw: unknown): HostState {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_STATE };
  const record = raw as Record<string, unknown>;
  return {
    port: isValidPort(record.port) ? record.port : DEFAULT_STATE.port,
    wizardOpened: record.wizardOpened === true,
  };
}

export function readHostState(file: string): HostState {
  try {
    return parseHostState(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/** Écriture atomique : un arrêt brutal ne laisse jamais un fichier à moitié écrit. */
export function writeHostState(file: string, state: HostState): void {
  const draft = `${file}.tmp`;
  writeFileSync(draft, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  renameSync(draft, file);
}
