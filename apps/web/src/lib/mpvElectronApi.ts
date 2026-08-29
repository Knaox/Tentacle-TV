/**
 * L'adaptateur mpv — le seul, depuis que la coquille est unique.
 *
 * Il traduit les appels du lecteur en commandes `mpv_*` et écoute les
 * évènements `mpv://*`. Les noms viennent de l'app Tauri et n'ont pas changé :
 * c'est ce qui a permis de migrer la coquille sans toucher au lecteur.
 *
 * ⚠️ `observeProperties` n'OBSERVE rien : l'observation est posée côté natif à
 * l'init, à partir de la liste qu'on lui a donnée. Ici on ne fait qu'écouter.
 */

import { invoke, listen, type Unlisten as UnlistenFn } from "../desktop/bridge";
import { pushHdrAuto } from "./hdrPreference";

export type MpvObservableProperty = readonly [string, string, ...unknown[]];

export interface MpvConfig {
  initialOptions?: Record<string, unknown>;
  observedProperties?: ReadonlyArray<MpvObservableProperty>;
}

/**
 * Démarre mpv, puis transmet la politique HDR au natif.
 *
 * Le partage est volontaire : la PAGE connaît la préférence de l'utilisateur, le
 * NATIF sait lire le gamma du média dès son ouverture et parler à l'écran. C'est
 * donc ici, au seul endroit qui voit les deux, que l'un informe l'autre.
 *
 * L'échec de cette transmission ne doit jamais empêcher une lecture : la
 * fonction avale ses erreurs, et l'absence de bascule n'est pas une panne — mpv
 * retombe sur le tone-mapping, qui donne une image correcte.
 */
/**
 * Electron préfixe tout rejet d'`invoke` de « Error invoking remote method
 * 'tentacle:mpv_init': Error: … ». C'est du bruit de transport : ce message
 * finit à l'écran (bandeau d'erreur du lecteur) et dans la décision de repli —
 * seule la cause courte compte.
 */
function cleanError(e: unknown): Error {
  const raw = e instanceof Error ? e.message : String(e);
  return new Error(raw.replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, ""));
}

export async function init(config?: MpvConfig): Promise<string> {
  let result: string;
  try {
    result = await invoke<string>("mpv_init", { options: config ?? {} });
  } catch (e) {
    throw cleanError(e);
  }
  await pushHdrAuto();
  return result;
}

export async function destroy(): Promise<void> {
  return invoke<void>("mpv_destroy");
}

export async function command(
  name: string,
  args?: (string | boolean | number)[],
): Promise<void> {
  return invoke<void>("mpv_command", { name, args: args ?? [] });
}

export async function setProperty(
  name: string,
  value: string | boolean | number,
): Promise<void> {
  return invoke<void>("mpv_set_property", { name, value });
}

/**
 * Ce qu'un format de mpv rend, en types.
 *
 * Le paquet Tauri le faisait ; le perdre aurait rendu `unknown` partout, et
 * chaque appelant aurait dû transtyper à la main — c'est-à-dire affirmer sans
 * vérifier. Le format est une constante à l'appel, donc le type se déduit.
 */
type ValueForFormat<F extends string> =
  F extends "flag" ? boolean
  : F extends "int64" | "double" ? number
  : F extends "string" ? string
  : unknown;

/**
 * Lit une propriété. `null` quand mpv ne peut pas répondre — propriété absente,
 * pas de fichier chargé — ce qui n'est pas une erreur et ne lève pas.
 */
export async function getProperty<F extends string>(
  name: string,
  format: F,
): Promise<ValueForFormat<F> | null> {
  return invoke<ValueForFormat<F> | null>("mpv_get_property", { name, format });
}

export async function observeProperties<
  T extends ReadonlyArray<MpvObservableProperty>,
>(
  _properties: T,
  callback: (event: { name: string; data: unknown; id: number }) => void,
): Promise<UnlistenFn> {
  return listen("mpv://property-change", (e) =>
    callback(e.payload as { name: string; data: unknown; id: number }),
  );
}

export async function listenEvents(
  callback: (event: { event: string; [key: string]: unknown }) => void,
): Promise<UnlistenFn> {
  return listen("mpv://event", (e) =>
    callback(e.payload as { event: string; [key: string]: unknown }),
  );
}
