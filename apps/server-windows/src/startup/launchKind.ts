/**
 * Comment l'app a été lancée : par l'utilisateur, ou par Windows à
 * l'ouverture de session. L'écran de démarrage ne se montre pas à chaque
 * session s'il n'a rien à dire (`splash/splashModel.ts` → `shouldShowSplash`).
 *
 * - Hors paquet, la clé `Run` porte `--autostart` (`runKey.ts`).
 * - Dans le paquet, la `StartupTask` lance le même exe avec les mêmes
 *   paramètres : seul `AppInstance.GetActivatedEventArgs()` le distingue —
 *   `ActivationKind.StartupTask` (1020). Fentes relevées dans le SDK 26100 :
 *   `IAppInstanceStatics::GetActivatedEventArgs` = 7
 *   (`windows.applicationmodel.h`), `IActivatedEventArgs::get_Kind` = 6
 *   (`windows.applicationmodel.activation.h`).
 *
 * Dans le doute (WinRT muet, vieux Windows), « lancé par l'utilisateur » :
 * mieux vaut un écran de trop qu'un premier lancement sans rien à l'écran.
 */
import { activationFactory, callForInt32, callForPointer, release } from "../winrt/com";
import { IID } from "../winrt/guid";

export const AUTOSTART_FLAG = "--autostart";
const ACTIVATION_KIND_STARTUP_TASK = 1020;

function packagedStartupTask(): boolean {
  const factory = activationFactory("Windows.ApplicationModel.AppInstance", IID.appInstanceStatics);
  if (factory === null) return false;
  try {
    const args = callForPointer(factory, 7);
    if (args === null) return false;
    try {
      return callForInt32(args, 6) === ACTIVATION_KIND_STARTUP_TASK;
    } finally {
      release(args);
    }
  } finally {
    release(factory);
  }
}

export function launchedAtLogon(argv: readonly string[], packaged: boolean): boolean {
  if (argv.includes(AUTOSTART_FLAG)) return true;
  if (!packaged) return false;
  try {
    return packagedStartupTask();
  } catch {
    return false;
  }
}
