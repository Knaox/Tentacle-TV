/**
 * Les images DÉJÀ montrées pendant cette session (leur `load` a eu lieu) : une
 * bannière, un halo ou une affiche qui se remonte sur l'une d'elles la montre
 * aussitôt, sans rejouer son apparition.
 *
 * Le clignotement qu'elle répare (signalé par Damien le 25/10, mesuré image par
 * image) : passer de l'accueil à « Pour vous » et retour remonte les pages ; la
 * MÊME bannière, les MÊMES affiches, déjà décodées et en cache, repartaient de
 * l'opacité nulle — la bannière sur 1,2 s, les affiches derrière leur squelette
 * scintillant. L'écran tombait au noir puis remontait à chaque clic.
 *
 * Une apparition (fondu d'entrée, squelette) n'a de sens que pour une image
 * qu'on n'a pas encore vue. Le fondu ENCHAÎNÉ d'une diapositive à l'autre n'est
 * pas une apparition : il reste.
 *
 * Borné (les plus anciennes sortent) : une session qui parcourt tout le
 * catalogue ne garde pas des milliers d'adresses. Mémoire du module, jamais
 * de stockage : une image vue hier n'est plus forcément décodée.
 */

export const SEEN_IMAGES_MAX = 600;

const seen = new Map<string, true>();

/** L'image s'est chargée et peinte : la retenir (et la rafraîchir si elle l'était). */
export function markImageSeen(url: string | null | undefined): void {
  if (!url) return;
  seen.delete(url);
  seen.set(url, true);
  if (seen.size > SEEN_IMAGES_MAX) {
    const oldest = seen.keys().next().value;
    if (oldest !== undefined) seen.delete(oldest);
  }
}

export function wasImageSeen(url: string | null | undefined): boolean {
  return !!url && seen.has(url);
}

/**
 * L'image peut-elle s'afficher TOUT DE SUITE ? Déjà montrée, ou disponible
 * dans le cache mémoire du navigateur : une image qu'on y cherche y est trouvée
 * DE FAÇON SYNCHRONE (la « liste des images disponibles » du HTML), et sonde
 * alors `complete` avec ses dimensions. Sinon (première fois, cache disque,
 * réseau), l'apparition se joue comme avant. La sonde ne demande rien de plus :
 * la même adresse, au même instant, que l'image qui va se monter.
 */
export function isImageReady(url: string | null | undefined): boolean {
  if (!url) return false;
  if (seen.has(url)) return true;
  if (typeof Image === "undefined") return false;
  const probe = new Image();
  probe.src = url;
  const ready = probe.complete && probe.naturalWidth > 0;
  if (ready) markImageSeen(url);
  return ready;
}

/** Pour les tests. */
export function resetSeenImagesForTests(): void {
  seen.clear();
}
