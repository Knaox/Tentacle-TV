/**
 * La sortie du lecteur, joignable d'où qu'on soit.
 *
 * `onBack` arrive par les propriétés de `PlayerControls` — il marque la sortie
 * puis recule dans la pile, ce dont dépend la transition de retour vers la
 * fiche. Les surcouches, elles, vivent dans l'AUTRE arbre React : elles ne
 * reçoivent rien de tout cela, et le leur faire descendre demanderait de
 * modifier le client web, que cette cible n'a pas le droit de toucher.
 *
 * D'où ce registre, du même genre que le magasin d'état : `ControlsTv` y
 * dépose ce qu'il sait faire, quiconque en a besoin l'appelle. Une seule
 * fonction, remplacée à chaque rendu du lecteur et retirée à son démontage —
 * appeler une sortie périmée ferait reculer la pile depuis un écran qu'on a
 * déjà quitté.
 */

let sortie: (() => void) | null = null;

/** Déposé par le lecteur, retiré en partant. */
export function setPlayerExit(quitter: (() => void) | null): void {
  sortie = quitter;
}

/**
 * Quitter l'épisode et revenir d'où l'on venait — fiche de la série, accueil,
 * ou ce que la pile de navigation porte.
 *
 * Rend `false` si le lecteur n'est plus là : l'appelant n'a alors rien à faire,
 * quelqu'un d'autre s'en est déjà chargé.
 */
export function exitPlayer(): boolean {
  if (!sortie) return false;
  sortie();
  return true;
}
