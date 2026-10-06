import { readFileSync, unlinkSync, writeFileSync } from "fs";
import { resolve } from "path";
import { DATA_ROOT } from "../../services/dataDir";
import { bareIp } from "./privateAddress";

/**
 * Qui a réclamé l'installation en cours : l'adresse du premier navigateur
 * entré (sans code depuis le réseau local, ou avec le code). Les autres
 * adresses ne la reprennent qu'avec le code.
 *
 * Gardée dans le volume de données, lisible du seul serveur : un redémarrage
 * en pleine installation ne rend pas la place au premier venu du réseau.
 * Oubliée à la fin de l'installation (`sealSetup`) et par `tentacle setup reset`.
 */
export const SETUP_CLAIMANT_FILE = resolve(DATA_ROOT, "setup-claimant");

export function claimantAddress(file = SETUP_CLAIMANT_FILE): string | null {
  try {
    const value = readFileSync(file, "utf-8").trim();
    return value && value.length <= 64 ? value : null;
  } catch {
    return null;
  }
}

export function recordClaimant(address: string, file = SETUP_CLAIMANT_FILE): void {
  writeFileSync(file, `${bareIp(address)}\n`, { mode: 0o600 });
}

export function forgetClaimant(file = SETUP_CLAIMANT_FILE): void {
  try {
    unlinkSync(file);
  } catch {
    /* rien à oublier */
  }
}
