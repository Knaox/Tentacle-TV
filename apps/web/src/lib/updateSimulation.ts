import { isMacOS, isWindows } from "../hooks/mpvRuntime";
import { APP_STORE_ID, appStoreUrlFor } from "./updateCheckers";
import type { UpdateInfo } from "./updateTypes";

/**
 * Pop-up de mise à jour de démonstration, pour le panneau de diagnostic.
 *
 * # Pourquoi ce n'est pas qu'un `setState`
 *
 * Une pop-up factice qui ne ferait rien ne prouverait rien : ce qu'on veut voir,
 * c'est la VRAIE pop-up avec le vrai bouton, et que ce bouton parte réellement
 * là où il doit partir. La simulation reproduit donc le canal de la plateforme
 * courante plutôt qu'un scénario générique :
 *
 *  • macOS — `isStoreUpdate`, et le bouton ouvre POUR DE BON la fiche de l'App
 *    Store. C'est sans risque et c'est le seul moyen de vérifier que le lien
 *    aboutit sur la bonne fiche, dans l'application App Store et non dans un
 *    navigateur ;
 *  • Windows — la phase de téléchargement, avec sa barre INDÉTERMINÉE (le Store
 *    ne rend aucun pourcentage), puis l'installation et le redémarrage. Aucun
 *    redémarrage réel : la démonstration s'arrête avant ;
 *  • Linux — l'auto-updater intégré : téléchargement à progression RÉELLE
 *    (barre déterminée), installation, redémarrage. Longtemps confondu avec
 *    macOS (« tout ce qui n'est pas Windows ») : la pop-up y annonçait l'App
 *    Store, et le bouton l'ouvrait.
 *
 * # La garde
 *
 * `import.meta.env.DEV` ne suffit pas : la coquille Electron sert un build de
 * PRODUCTION même en développement (cf. apps/web/vite.config.ts), donc ce crochet
 * n'existait pas là où on en a le plus besoin. La garde est la même que celle du
 * panneau lui-même — `import.meta.env.DEV || __PLAYER_DEBUG__` —, et
 * `__PLAYER_DEBUG__` est faux dans tout paquet livré : Vite élimine alors le code
 * mort, il ne reste rien dans le bundle.
 */

export function updateDebugEnabled(): boolean {
  return import.meta.env.DEV || (typeof __PLAYER_DEBUG__ !== "undefined" && __PLAYER_DEBUG__);
}

/** Vrai tant qu'une pop-up de démonstration est en cours. */
let simulation = false;

export function isSimulatingUpdate(): boolean {
  return simulation;
}

export function stopSimulatingUpdate(): void {
  simulation = false;
}

export type SimulatedChannel = "appStore" | "microsoftStore" | "linux";

/** Le canal que la démonstration imite : celui de la plateforme courante. */
export function simulatedChannel(): SimulatedChannel {
  if (isMacOS()) return "appStore";
  if (isWindows()) return "microsoftStore";
  return "linux";
}

const SIMULATED_NOTES: Record<SimulatedChannel, string> = {
  appStore:
    "Démonstration — le bouton ouvre réellement la fiche de l'App Store.\n• Vérification de la pop-up\n• Vérification du lien vers le Store\n• Aucune mise à jour ne sera installée",
  microsoftStore:
    "Démonstration — aucune mise à jour ne sera installée.\n• Vérification de la pop-up\n• Barre indéterminée du Microsoft Store\n• Aucun redémarrage",
  linux:
    "Démonstration — aucune mise à jour ne sera installée.\n• Vérification de la pop-up\n• Barre de téléchargement de l'auto-updater Linux\n• Aucun redémarrage",
};

/** L'état à afficher pour une pop-up de démonstration. */
export function simulatedUpdate(defaults: UpdateInfo): UpdateInfo {
  simulation = true;
  const channel = simulatedChannel();
  const store = channel === "appStore";
  return {
    ...defaults,
    available: true,
    phase: "available",
    version: "9.9.9",
    notes: SIMULATED_NOTES[channel],
    isStoreUpdate: store,
    storeUrl: store ? appStoreUrlFor(APP_STORE_ID) : undefined,
  };
}

/**
 * Déroulé factice de l'installation : téléchargement (indéterminé sur le
 * Microsoft Store, à progression réelle sur Linux), installation, redémarrage.
 * Rend la main sans avoir rien installé ni relancé.
 */
export async function runSimulatedInstall(
  patch: (next: Partial<UpdateInfo>) => void,
  reset: () => void,
): Promise<void> {
  if (simulatedChannel() === "linux") {
    patch({ downloading: true, phase: "downloading", progress: 0, indeterminate: false, error: null });
    for (let pct = 5; pct <= 100; pct += 5) {
      await pause(140);
      patch({ progress: pct });
    }
    patch({ phase: "installing", progress: 100 });
  } else {
    patch({ downloading: true, phase: "downloading", progress: 0, indeterminate: true, error: null });
    await pause(3500);
    patch({ phase: "installing", indeterminate: false, progress: 100 });
  }
  await pause(1500);
  patch({ phase: "restarting" });
  await pause(2000);
  simulation = false;
  reset();
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
