/**
 * La naissance d'une instance mpv : init, surface vidéo, attache.
 *
 * Deux appelants : `mpv_init` (la page ouvre le lecteur) et le préchauffage
 * (`videoLifecycle.ts`, l'instance mince née d'avance). Le même geste, pour que
 * l'instance préchauffée soit EXACTEMENT celle qu'un `mpv_init` aurait créée —
 * c'est ce qui permet de la reprendre ensuite (`mpvPark.ts`, signature).
 */

import type { BrowserWindow } from "electron";
import { init } from "../video/mpv";
import type { MpvValue } from "../video/mpvAllowlist";
import { nativeHandle } from "../video/native";
import { createVideoSurface } from "../video/surface";
import { getMainWindow } from "../window";
import { eventRelay } from "./videoEvents";
import { assembleInitOptions } from "./videoInitOptions";
import { adoptSurface, currentSurface, rememberInit } from "./videoLifecycle";
import type { InitRequest } from "./videoPrewarm";

type Observed = ReadonlyArray<readonly [string, string]>;

/**
 * Crée l'instance, puis attache sa surface. `onInit` est appelé entre les deux
 * — l'horloge du démarrage y date l'init. Rend le motif de l'échec, ou `null`.
 */
export async function launchInstance(
  win: BrowserWindow,
  options: Readonly<Record<string, MpvValue>>,
  observed: Observed,
  onInit?: () => void,
): Promise<string | null> {
  const err = init({ options, observed, wid: nativeHandle(win) }, eventRelay(currentSurface));
  if (err) return err;
  rememberInit(options, observed);
  onInit?.();
  // La fenêtre de mpv naît de façon asynchrone : `attach` la cherche, puis la
  // désarme et la maintient calée à chaque changement de géométrie. Les
  // écouteurs de la fenêtre principale appartiennent à `VideoWindow` et partent
  // avec elle — posés ici, rien ne les retirait, et le lecteur est remonté à
  // chaque épisode.
  adoptSurface(createVideoSurface(win));
  await currentSurface()?.attach();
  return null;
}

/**
 * Le lanceur du préchauffage (`videoPrewarm.ts`) : la même naissance que
 * `mpv_init`, options assemblées de la même façon — sinon la signature
 * différerait et l'instance ne serait jamais reprise.
 */
export async function launchForRequest(request: InitRequest): Promise<boolean> {
  const win = getMainWindow();
  if (!win || win.isDestroyed()) return false;
  const options = await assembleInitOptions(win, request.page);
  const err = await launchInstance(win, options, request.observed);
  if (err !== null) console.warn(`[mpv] préchauffage : ${err}`);
  return err === null;
}
