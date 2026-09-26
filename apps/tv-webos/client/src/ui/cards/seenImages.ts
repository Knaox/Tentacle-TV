/**
 * Les images de carte déjà arrivées une fois pendant la session.
 *
 * Une carte remontée — rangée vidée puis remplie, fenêtre qui glisse — ne doit
 * pas rejouer l'entrée d'une image qu'on vient de voir : elle s'affiche
 * d'emblée (`CardImageTv`). Le navigateur la ressert de son cache ; il suffit
 * de savoir qu'elle y est, sans rien lui demander.
 *
 * Bornée : au-delà, les plus anciennes sortent. Une adresse oubliée ne coûte
 * qu'un fondu de plus, jamais une image fausse.
 */

const LIMIT = 600;
const seen = new Set<string>();

export function knownImage(url: string): boolean {
  return seen.has(url);
}

export function rememberImage(url: string): void {
  if (seen.has(url)) return;
  seen.add(url);
  if (seen.size > LIMIT) {
    // Un `Set` itère dans l'ordre d'insertion : la première est la plus ancienne.
    const oldest = seen.values().next().value;
    if (oldest !== undefined) seen.delete(oldest);
  }
}
