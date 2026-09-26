/**
 * Les images de carte arrivées récemment, gardées prêtes à resservir.
 *
 * Une carte remontée — rangée vidée puis remplie, grille qui défile, retour
 * d'une fiche — ne doit ni rejouer l'entrée d'une image qu'on vient de voir, ni
 * l'attendre : elle s'affiche d'emblée (`CardImageTv`).
 *
 * **Savoir qu'elle est arrivée ne suffit pas : il faut la RETENIR.** Le moteur
 * de la dalle ne garde en mémoire que les images qu'un élément référence encore,
 * et son cache disque ne sert rien (mesuré : aucune réponse `fromDiskCache`).
 * Une carte démontée libérait donc son affiche, et la carte remontée la
 * redemandait au réseau — 149 affiches redemandées pour deux allers-retours
 * rapides dans une bibliothèque, autant de cartes VIDES le temps du trajet puis
 * une affiche qui surgit. Une `Image` détachée par adresse garde la ressource
 * vivante : une nouvelle `<img>` la reprend alors dans la même image, sans
 * requête.
 *
 * Ce que ça coûte : les données compressées des dernières images, pas leurs
 * pixels — une `Image` jamais peinte n'est pas décodée. Une affiche pèse ~40 Ko
 * (mesuré), la borne tient donc autour de 8 Mo. Au-delà, la plus ancienne est
 * relâchée et le ramasse-miettes la reprend ; elle refera un fondu si on la
 * revoit, jamais une image fausse.
 *
 * Condition : que la réponse soit FRAÎCHE. Une image arrivée périmée — un `Age`
 * de l'amont plus grand que le `max-age` du serveur — est redemandée malgré la
 * ressource vivante (cf. `skipResponseHeader` côté backend).
 */

const LIMIT = 200;
/** Ordre d'insertion = ordre d'usage : la première entrée est la moins récente. */
const retained = new Map<string, HTMLImageElement>();

/** L'image est-elle prête à s'afficher dans la même image qu'on la demande ? */
export function knownImage(url: string): boolean {
  return retained.has(url);
}

/** À appeler quand une `<img>` de carte a fini de charger `url`. */
export function rememberImage(url: string): void {
  const held = retained.get(url);
  if (held) {
    // Revue : elle redevient la plus récente.
    retained.delete(url);
    retained.set(url, held);
    return;
  }
  // La ressource vient d'arriver pour la carte : cette `Image` la reprend de la
  // mémoire du moteur, sans nouvelle requête.
  const holder = new Image();
  holder.src = url;
  retained.set(url, holder);
  if (retained.size > LIMIT) {
    const oldest = retained.keys().next().value;
    if (oldest !== undefined) retained.delete(oldest);
  }
}
