import { writeFileSync } from "fs";
import { join } from "path";
import { DATA_ROOT } from "../services/dataDir";
import { FRESH_START_FILE, orphanedLegacyInstallation, SECRETS_DIR } from "../dbMigration/orphanedSource";
import { refuseSymlink, restrictToOwner } from "../dbMigration/migrationFiles";
import { unsealSetup } from "../setup/setupLock";

/**
 * `tentacle db start-fresh --confirm` — la PORTE DE SORTIE du blocage
 * `source_missing` : l'ancienne MariaDB est perdue pour de bon (ou abandonnée
 * volontairement), on repart d'une installation neuve. Seulement à la machine,
 * jamais par HTTP ; l'écran public dit seulement « voir la documentation ».
 * Rien n'est touché dans l'ancienne base ; l'assistant se rouvre.
 */
export const DB_START_FRESH_USAGE = [
  "  tentacle db start-fresh --confirm   repartir d'une installation neuve (l'ancienne MariaDB n'est pas touchée)",
  "                         start from a new installation (the old MariaDB is not touched)",
];

const say = (fr: string, en: string) => console.log(`${fr}\n${en}`);

export function runDbStartFresh(args: string[], dataRoot: string = DATA_ROOT, secretsDir: string = SECRETS_DIR): number {
  if (!orphanedLegacyInstallation(null, dataRoot, secretsDir)) {
    say("Rien à faire : ce serveur n'attend pas une ancienne base MariaDB.", "Nothing to do: this server is not waiting for an old MariaDB database.");
    return 0;
  }
  if (!args.includes("--confirm")) {
    say(
      "Repartir de zéro : Tentacle créera une base NEUVE et l'assistant se rouvrira. Les données de l'ancienne MariaDB n'y seront pas (elles n'y sont pas effacées pour autant). Pour confirmer : tentacle db start-fresh --confirm",
      "Start from scratch: Tentacle will create a NEW database and the setup wizard will reopen. The old MariaDB's data won't be in it (it isn't erased either). To confirm: tentacle db start-fresh --confirm",
    );
    return 2;
  }
  const marker = join(dataRoot, FRESH_START_FILE);
  refuseSymlink(marker);
  writeFileSync(marker, `${new Date().toISOString()}\n`, { mode: 0o600 });
  restrictToOwner(marker);
  unsealSetup(join(dataRoot, "setup-complete"));
  say(
    "C'est noté. Redémarrez Tentacle : une installation neuve démarrera, l'assistant s'ouvrira. L'ancienne MariaDB n'a pas été touchée.",
    "Done. Restart Tentacle: a new installation will start and the setup wizard will open. The old MariaDB was not touched.",
  );
  return 0;
}
