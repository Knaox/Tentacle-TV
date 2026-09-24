/**
 * Le lecteur ouvert, s'il y en a un — pour ce qui doit le quitter sans le
 * connaître. Une notification tapée en pleine lecture ouvre sa destination
 * APRÈS avoir quitté le lecteur : sinon la fiche s'empilait par-dessus, le film
 * continuait dessous, et « Retour » y ramenait.
 *
 * Un seul lecteur à la fois : le suivant (épisode, relance) remplace le
 * précédent, qui ne peut plus effacer l'inscription d'un autre.
 */
type Release = () => void;

let current: Release | null = null;

/** Inscrit le lecteur qui vient de s'ouvrir ; rend sa désinscription. */
export function registerOpenPlayer(release: Release): () => void {
  current = release;
  return () => {
    if (current === release) current = null;
  };
}

/** Éteint le lecteur ouvert (moteur, image dans l'image, écran verrouillé) ; vrai s'il y en avait un. */
export function releaseOpenPlayer(): boolean {
  const release = current;
  if (release === null) return false;
  current = null;
  release();
  return true;
}
