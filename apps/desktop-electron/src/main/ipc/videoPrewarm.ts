/**
 * Le préchauffage de mpv : une instance MINCE, née d'avance et gardée.
 *
 * Sous Linux, la sortie vidéo d'une instance neuve coûte ~0,4-0,6 s de Vulkan
 * sur NVIDIA, puis l'interop CUDA — c'était la seconde d'attente de chaque
 * PREMIER titre (voir `mpvPark.ts` pour les mesures). L'instance mince la paie
 * d'avance, hors du chemin de l'utilisateur : née sans fichier, `force-window`
 * lui fait monter sa sortie vidéo aussitôt, et elle attend, garée sous notre
 * fenêtre, qu'un `mpv_init` aux mêmes options la reprenne. 91 Mio de VRAM et
 * aucun contexte CUDA tant qu'elle n'a rien lu.
 *
 * Trois naissances :
 *
 * - `mpv_prewarm`, que la page envoie une fois connectée et au repos, avec
 *   les options qu'elle donnerait à `mpv_init` — sans elles, pas de reprise ;
 * - le recyclage : l'instance chaude d'après lecture a expiré (`HOT_PARK_MS`),
 *   une mince prend sa place avec la DERNIÈRE demande de la page ;
 * - le retour sur secteur.
 *
 * Et deux morts anticipées : le passage sur batterie arrête l'instance garée,
 * qui tiendrait éveillé le GPU dédié d'un portable hybride (`parkPolicy`) ; la
 * mise en veille aussi — sans `NVreg_PreserveVideoMemoryAllocations`, un
 * périphérique Vulkan NVIDIA peut revenir PERDU du réveil, et l'instance garée
 * ferait échouer la lecture suivante. Une neuve naît après le réveil.
 *
 * Le montage collé seulement (`parkable`), comme le parking lui-même.
 */

import type { MpvValue } from "../video/mpvAllowlist";
import { isRunning } from "../video/mpv";
import { parkPolicy } from "../video/mpvPark";
import {
  configureParking,
  isParked,
  parkable,
  parkSlim,
  serialized,
  stopPlayer,
} from "./videoLifecycle";

type Observed = ReadonlyArray<readonly [string, string]>;

/** Ce que la page demande à `mpv_init` — de quoi faire naître la même instance. */
export interface InitRequest {
  page: Readonly<Record<string, MpvValue>>;
  observed: Observed;
}

/** Ce dont le préchauffage a besoin, injecté (Electron en vrai, des doublures en test). */
export interface PrewarmDeps {
  onBattery: () => boolean;
  /** Fait naître une instance pour la demande ; `false` si rien n'a pu naître. */
  launch: (request: InitRequest) => Promise<boolean>;
}

/** Les évènements d'alimentation — la part de `powerMonitor` dont on se sert. */
export interface PowerEvents {
  on(event: "on-battery" | "on-ac" | "suspend" | "resume", listener: () => void): unknown;
}

/** Après le réveil : le temps que le pilote et le compositeur se remettent. */
export const RESUME_PREWARM_DELAY_MS = 5000;

let deps: PrewarmDeps | null = null;
let lastRequest: InitRequest | null = null;

/** La dernière demande de la page : c'est elle que le recyclage reproduit. */
export function rememberRequest(request: InitRequest): void {
  lastRequest = request;
}

/**
 * Fait naître une instance mince si rien ne tourne. Rend ce qui s'est passé,
 * pour le journal — jamais une erreur : un préchauffage manqué ne coûte que
 * l'attente d'avant.
 */
export async function prewarmPlayer(why: string, request: InitRequest | null = lastRequest): Promise<string> {
  if (!parkable()) return "montage sans parking";
  if (deps === null) return "préchauffage non branché";
  if (request !== null) rememberRequest(request);
  if (!parkPolicy(deps.onBattery()).prewarm) return "sur batterie";
  if (request === null) return "aucune demande de la page à reproduire";
  if (isRunning()) return "instance déjà là";
  const started = performance.now();
  if (!(await deps.launch(request))) return "échec du lancement";
  if (!parkSlim()) return "instance perdue pendant le lancement";
  console.info(
    `[mpv] instance préchauffée (${why}) en ${String(Math.round(performance.now() - started))} ms ` +
      "— sa sortie vidéo naît en arrière-plan",
  );
  return "préchauffée";
}

/** Branche le préchauffage : le recyclage du parking, et l'alimentation. */
export function installPrewarm(next: PrewarmDeps, power?: PowerEvents): void {
  deps = next;
  configureParking({
    onBattery: next.onBattery,
    recycle: () => prewarmPlayer("recyclage de l'instance chaude"),
  });
  const releaseParked = (why: string): void => {
    void serialized(async () => {
      if (!isParked()) return;
      console.info(`[mpv] ${why} — l'instance garée est arrêtée`);
      await stopPlayer();
    });
  };
  power?.on("on-battery", () => releaseParked("passage sur batterie"));
  power?.on("on-ac", () => {
    void serialized(() => prewarmPlayer("retour sur secteur"));
  });
  power?.on("suspend", () => releaseParked("mise en veille"));
  power?.on("resume", () => {
    setTimeout(() => {
      void serialized(() => prewarmPlayer("réveil"));
    }, RESUME_PREWARM_DELAY_MS);
  });
}
