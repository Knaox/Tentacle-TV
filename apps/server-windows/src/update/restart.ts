/**
 * La relance de l'hôte après une mise à jour du Store : `RegisterApplicationRestart`
 * (« if the application is being updated and requires a restart, the
 * application is restarted automatically », après 60 s de vie au moins).
 *
 * Windows relance l'EXE avec la ligne donnée ici : elle reprend donc les
 * paramètres du manifeste (`manifest.test.mts` les compare). Si Windows passe
 * aussi par l'activation du paquet et ajoute les siens, Node ne lit que le
 * premier `-e` et tout ce qui suit `--` est un argument : sans effet.
 *
 * ⚠️ Ne se charge que sous Windows.
 */
import koffi from "koffi";

/** Les paramètres de l'application dans le manifeste, à l'identique. */
export const HOST_BOOTSTRAP =
  "-e \"require(require('path').join(require('path').dirname(process.execPath),'apps','server-windows','dist','main.js'))\" --";

const kernel32 = koffi.load("kernel32.dll");
const RegisterApplicationRestart = kernel32.func("long RegisterApplicationRestart(const char16_t *commandLine, uint32 flags)");

/** Ni après un plantage, ni un gel, ni un redémarrage de Windows : seulement après une mise à jour. */
const RESTART_NO_CRASH = 0x1;
const RESTART_NO_HANG = 0x2;
const RESTART_NO_REBOOT = 0x8;

export function registerRestartAfterUpdate(): boolean {
  return (RegisterApplicationRestart(HOST_BOOTSTRAP, RESTART_NO_CRASH | RESTART_NO_HANG | RESTART_NO_REBOOT) as number) === 0;
}
