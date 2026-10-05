import { existsSync, unlinkSync, writeFileSync } from "fs";
import { resolve } from "path";
import { DATA_ROOT } from "../services/dataDir";
import { isSetupComplete } from "../services/configStore";

/**
 * L'installation finie se FERME pour toujours : toutes les routes d'action de
 * l'assistant répondent 404, et aucune requête HTTP ne la rouvre. Seule la
 * commande `tentacle setup reset`, lancée sur la machine, le peut.
 *
 * Deux preuves, et l'une suffit : le drapeau `setup_completed` de la base, et
 * ce fichier du volume de données. Le fichier tient quand la base ne répond
 * pas au démarrage — sinon un serveur installé, base en panne, se croirait
 * neuf et rouvrirait son assistant.
 */
export const SETUP_LOCK_FILE = resolve(DATA_ROOT, "setup-complete");

export function isSetupClosed(lockFile = SETUP_LOCK_FILE): boolean {
  return existsSync(lockFile) || isSetupComplete();
}

/** Pose le fichier — à la fin de l'assistant, et pour une installation d'avant (base déjà complète). */
export function sealSetup(lockFile = SETUP_LOCK_FILE, now = new Date()): void {
  if (existsSync(lockFile)) return;
  writeFileSync(lockFile, `${now.toISOString()}\n`, { mode: 0o600 });
}

/** `tentacle setup reset` seulement. */
export function unsealSetup(lockFile = SETUP_LOCK_FILE): void {
  try {
    unlinkSync(lockFile);
  } catch {
    /* déjà ouvert */
  }
}
