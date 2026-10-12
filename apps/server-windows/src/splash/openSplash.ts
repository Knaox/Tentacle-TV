/**
 * Ouvre l'écran de démarrage s'il a quelque chose à dire
 * (`shouldShowSplash`), au tout début de l'hôte. Un échec (GDI+ refusé,
 * session sans bureau) n'empêche jamais le serveur de démarrer : l'icône de la
 * zone de notification reste, et le journal dit pourquoi.
 */
import { SplashWindow } from "../win32/splashWindow";
import { shouldShowSplash, splashView, type SplashActionId, type SplashContext } from "./splashModel";

export interface SplashOpening {
  window: SplashWindow | null;
  /** Une ligne pour le journal (écrit plus tard : le dossier des journaux n'existe pas encore). */
  outcome: string;
}

export function openSplash(options: {
  atLogon: boolean;
  setupPending: boolean;
  startupAsked: boolean;
  logo: string | null;
  icon: string | null;
  context: SplashContext;
  onAction: (id: SplashActionId) => void;
}): SplashOpening {
  const { atLogon, setupPending, startupAsked } = options;
  if (!shouldShowSplash({ atLogon, setupPending, startupAsked })) return { window: null, outcome: "rien à dire au démarrage de session" };
  try {
    const initial = splashView({ state: null, wizardOpening: false, setupPending, question: "hidden" }, options.context);
    const window = new SplashWindow(options.logo, options.icon, initial, options.onAction);
    return { window, outcome: `ouvert${atLogon ? " (démarrage de session)" : ""}${options.logo === null ? ", sans logo" : ""}` };
  } catch (error) {
    return { window: null, outcome: `non ouvert : ${error instanceof Error ? error.message : String(error)}` };
  }
}
