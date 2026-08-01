/**
 * Le pouls du processus principal — développement uniquement.
 *
 * # Pourquoi une ligne de journal ne suffit pas
 *
 * Le gel du thread principal est le défaut caractéristique de ce portage : un
 * appel synchrone vers libmpv attend le cœur de mpv, qui attend ce même thread
 * (voir `video/mpvFfi.ts`). Il ne ressemble à rien — zéro pourcent de
 * processeur, aucune exception, aucun rapport de plantage — et le journal ne
 * s'arrête pas là où le blocage se produit, mais là où la dernière ligne avait
 * été écrite. Deux séances entières se sont passées à chercher entre les deux.
 *
 * Un battement régulier tranche la question sans rien instrumenter : s'il
 * saute, le thread principal a été retenu, et on sait de combien. C'est
 * objectif et immédiat, là où « l'application semble figée » ne l'est pas.
 *
 * On ne trace QUE les sauts : un battement bavard noierait le journal, et c'est
 * l'anomalie qu'on veut voir, pas la normalité.
 */

import { app } from "electron";

/** Dix par seconde : assez fin pour dater un gel, assez rare pour être gratuit. */
const PERIODE_MS = 100;

/**
 * Au-delà, le retard n'est plus l'ordonnanceur.
 *
 * Un rendu React chargé ou une lecture de disque retiennent le thread quelques
 * dizaines de millisecondes ; ce n'est pas ce qu'on cherche. Un gel, lui, se
 * compte en secondes.
 */
const SEUIL_MS = 250;

let pouls: ReturnType<typeof setInterval> | null = null;

/** Démarre le battement. Sans effet dans un paquet livré, ou s'il bat déjà. */
export function demarrerBattement(): void {
  if (app.isPackaged || pouls !== null) return;
  let precedent = Date.now();
  pouls = setInterval(() => {
    const maintenant = Date.now();
    const retard = maintenant - precedent - PERIODE_MS;
    precedent = maintenant;
    if (retard >= SEUIL_MS) {
      console.warn(`[battement] thread principal retenu ${String(retard)} ms`);
    }
  }, PERIODE_MS);
  // Le battement ne doit pas être une raison de garder le processus en vie.
  pouls.unref();
}
