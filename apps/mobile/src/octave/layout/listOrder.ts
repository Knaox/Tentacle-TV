/**
 * Octave (mobile) — l'IDENTITÉ d'un ordre de cartes (`listOrder.test.ts`), pour la clé d'une rangée qui peut se
 * réordonner : un nouvel ordre est une rangée NEUVE, jamais des cellules déplacées.
 *
 * Sous Fabric, une cellule déplacée pendant que sa carte joue son entrée (`enterMotion`, Reanimated) perd
 * l'animation et la carte reste à ses valeurs de départ : invisible, une place vide. C'est le bogue de l'accueil
 * (28/10) : au retour sur la page, l'accueil se montre d'abord dans l'ordre gardé en cache, les cartes entrent,
 * puis la réponse du serveur (les écoutes de la recherche) remonte en tête ce qu'on vient d'écouter — les
 * cellules se déplaçaient en pleine entrée. Une rangée remontée ne rejoue pas l'entrée des cartes déjà vues
 * (`useFirstEnter` garde sa mémoire hors de la liste) ; son défilement horizontal repart du début, là où arrive
 * ce qu'on vient d'écouter. Un même ordre (contenu rafraîchi) garde la même rangée.
 *
 * Module pur (aucun import de React Native).
 */

export function listOrderIdentity(keys: readonly string[]): string {
  // Le caractère nul ne paraît dans aucune clé de carte (`jf:…`, identifiants d'extension).
  return keys.join("\u0000");
}
