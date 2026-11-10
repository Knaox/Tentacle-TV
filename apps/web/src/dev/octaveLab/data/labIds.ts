/**
 * Labo d'Octave — des identifiants à la forme de ceux de JELLYFIN (32 chiffres hexadécimaux),
 * tirés d'un nom lisible : les règles partagées les exigent ainsi (`parseListKey` n'accepte qu'une
 * playlist à l'identifiant hexadécimal — sans lui, sa vue attend sa préférence d'ordre sans fin).
 */

/** FNV-1a sur 32 bits, avec une graine. */
function hash(text: string, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** L'identifiant stable d'un nom du labo (`al-marees`, `pl-matins`…). */
export function labId(slug: string): string {
  return [1, 2, 3, 4].map((seed) => hash(slug, seed * 0x9e3779b1).toString(16).padStart(8, "0")).join("");
}
