/**
 * Adaptateur mpv pour la coquille Electron.
 *
 * La surface est celle de l'adaptateur macOS — mêmes commandes `mpv_*`, mêmes
 * évènements `mpv://*` — parce que la coquille Electron implémente exactement
 * le contrat que le côté Rust remplit sur macOS. On ré-exporte plutôt que de
 * recopier : dupliquer soixante lignes pour ne changer qu'un nom de fichier
 * serait précisément ce que la règle de non-duplication interdit.
 *
 * Seul `init` est enrichi, de ce qui est propre à Electron.
 */

import * as base from "./mpvMacosApi";
import { pousserHdrAuto } from "./hdrPreference";

export * from "./mpvMacosApi";

/**
 * Démarre mpv, puis transmet la politique HDR au natif.
 *
 * Le partage est volontaire : la PAGE connaît la préférence de l'utilisateur,
 * le NATIF sait lire le gamma du média dès son ouverture et parler à Windows.
 * C'est donc ici, au seul endroit qui voit les deux, que l'un informe l'autre.
 *
 * L'échec de cette transmission ne doit jamais empêcher une lecture : la
 * fonction avale ses erreurs, et l'absence de bascule n'est pas une panne — mpv
 * retombe sur le tone-mapping, qui donne une image correcte.
 */
export async function init(config?: base.MpvConfig): Promise<string> {
  const resultat = await base.init(config);
  await pousserHdrAuto();
  return resultat;
}
