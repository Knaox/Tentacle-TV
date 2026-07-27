/**
 * Ce paquet est-il un build de DIAGNOSTIC ?
 *
 * # Le problème
 *
 * Tout ce qui aide à comprendre une panne — outils de développement, relais de
 * la console du rendu, journal du protocole applicatif, traces de la fenêtre
 * vidéo — était gardé par `!app.isPackaged`. Un paquet livré est donc MUET, et
 * c'est exactement l'endroit où l'on a besoin qu'il parle : le mode
 * développement sert le web depuis un autre chemin, avec un autre chargeur, et
 * ne reproduit pas ce que l'exe empaqueté vit.
 *
 * # Le marqueur, et pourquoi un fichier
 *
 * `scripts/package.mjs --debug` dépose un fichier vide `DEBUG` dans les
 * ressources du paquet. À l'exécution, sa présence rallume tout.
 *
 * Un fichier plutôt qu'une variable d'environnement : il VOYAGE AVEC LE
 * PAQUET. On remet un dossier, il se lance normalement, et le diagnostic est
 * là — rien à savoir, rien à poser dans son shell. Et surtout : le paquet de
 * release ne le porte pas, donc il ne peut pas s'allumer par accident sur la
 * machine d'un utilisateur.
 *
 * # Un seul endroit décide
 *
 * C'est TOUTE la raison d'être de ce module. La règle « développement, ou
 * marqueur présent » est écrite ici et nulle part ailleurs : cinq appelants la
 * consultent, aucun ne la réinvente.
 *
 * ⚠️ Ne pas confondre avec les `app.isPackaged` qui résolvent des CHEMINS
 * (`webRoot`, `windowIconPath`, `libmpvPath`). Ceux-là répondent à « où sont
 * les ressources », pas à « faut-il parler ». Ils ne changent pas.
 */

import { app } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";

/** Nom du marqueur dans les ressources du paquet. */
export const MARQUEUR = "DEBUG";

/**
 * Mémorisé au premier appel.
 *
 * `trace()` du protocole applicatif est appelé pour CHAQUE ressource servie —
 * chaque module, chaque affiche. Relire le disque à chaque fois ajouterait un
 * appel système par requête, pour une réponse qui ne peut pas changer.
 */
let cache: boolean | null = null;

export function estBuildDebug(): boolean {
  if (cache !== null) return cache;
  cache = !app.isPackaged || existsSync(path.join(process.resourcesPath, MARQUEUR));
  return cache;
}
