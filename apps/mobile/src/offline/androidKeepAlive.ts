/**
 * Les minuteurs du JavaScript vivants pendant un transfert, application
 * derrière — Android seulement.
 *
 * React Native gèle `setTimeout` dès que l'activité passe en pause, SAUF
 * pendant une tâche « headless ». Le service de premier plan gardait le flux,
 * mais plus rien de ce qui attend un délai ne partait : la relance d'une
 * coupure (`NETWORK_RETRY_DELAYS_MS`), le délai d'une requête, le rythme du
 * suivi en direct — un transfert coupé une fois écran éteint ne repartait
 * jamais (alpha mobile, 21/10). Le temps que le moteur s'occupe, une tâche sans
 * fin garde l'horloge en marche (`JsKeepAlive.kt`) ; elle se termine quand le
 * moteur se libère.
 *
 * Plusieurs demandeurs peuvent la tenir (les transferts, la musique d'Octave qui enchaîne ses titres) : elle
 * ne se termine que quand le DERNIER la rend.
 *
 * iOS n'en a pas l'usage : son JavaScript est suspendu tout entier, et ce sont
 * la session d'arrière-plan et la notification silencieuse du serveur qui le
 * réveillent.
 */

import { requireOptionalNativeModule } from "expo";
import { AppRegistry, Platform } from "react-native";

/** Le nom de la tâche, partagé avec `JsKeepAlive.TASK_KEY` (Kotlin). */
export const KEEP_ALIVE_TASK = "TentacleOfflineTransfers";

interface KeepAliveNative {
  holdJsAlive?(): boolean;
  releaseJsAlive?(): boolean;
}

const native = Platform.OS === "android" ? requireOptionalNativeModule<KeepAliveNative>("OfflineStorage") : null;

let registered = false;
let wanted = false;
let finish: (() => void) | null = null;
/** Qui tient l'horloge : « transfers » (défaut, le moteur hors ligne), « music » (Octave)… */
const holders = new Set<string>();

/** La tâche elle-même : elle dure tant que le moteur est occupé. */
async function keepAliveTask(): Promise<void> {
  if (!wanted) return;
  await new Promise<void>((resolve) => {
    finish = resolve;
  });
}

function register(): void {
  if (registered) return;
  registered = true;
  AppRegistry.registerHeadlessTask(KEEP_ALIVE_TASK, () => keepAliveTask);
}

/** Le moteur s'occupe : l'horloge reste en marche. Sans effet hors Android ou sans build récent. */
export function holdJsAlive(holder = "transfers"): void {
  if (native === null || typeof native.holdJsAlive !== "function") return;
  holders.add(holder);
  if (wanted) return;
  register();
  wanted = true;
  try {
    native.holdJsAlive();
  } catch {
    wanted = false;
  }
}

/** Le moteur se libère : la tâche se termine (le natif la termine aussi, par sûreté) si plus personne ne la tient. */
export function releaseJsAlive(holder = "transfers"): void {
  holders.delete(holder);
  if (!wanted || holders.size > 0) return;
  wanted = false;
  finish?.();
  finish = null;
  try {
    native?.releaseJsAlive?.();
  } catch {
    // Contexte déjà détruit : la tâche est partie avec lui.
  }
}
