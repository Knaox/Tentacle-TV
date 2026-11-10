/**
 * La couleur MOYENNE d'une image, lue dans son blurhash — sans le décoder.
 *
 * Jellyfin joint à chaque image un blurhash (`ImageBlurHashes`). Son premier terme (les
 * caractères 2 à 5) est la composante continue : la couleur moyenne de l'image, en sRGB sur
 * 24 bits. C'est elle qu'on peint en attendant l'image (docs/REFONTE-UI.md, « Une image qui
 * ne clignote pas ») : un aplat à la bonne teinte, puis UN fondu. Quatre caractères à lire —
 * rien à voir avec le décodage complet d'un blurhash (un canevas par carte).
 */

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";

/** `rgb(r, g, b)` de la couleur moyenne, ou `null` si la chaîne n'est pas un blurhash. */
export function blurhashAverageColor(hash: string | null | undefined): string | null {
  if (!hash || hash.length < 6) return null;
  let value = 0;
  for (let i = 2; i < 6; i++) {
    const digit = DIGITS.indexOf(hash[i]!);
    if (digit === -1) return null;
    value = value * 83 + digit;
  }
  // Quatre chiffres en base 83 peuvent dépasser 24 bits : ce n'est alors pas une composante continue.
  if (value > 0xffffff) return null;
  return `rgb(${value >> 16}, ${(value >> 8) & 255}, ${value & 255})`;
}

/** Les blurhash d'un titre Jellyfin : `{ Primary: { <tag>: <hash> }, Backdrop: … }`. */
export type ImageBlurHashes = Partial<Record<string, Record<string, string>>>;

/**
 * La couleur d'attente d'une image d'un titre : celle du blurhash de `tag` s'il est donné,
 * sinon du premier de ce type. `null` : le serveur n'en a pas — l'appelant garde l'encre.
 */
export function imageColorOf(hashes: ImageBlurHashes | null | undefined, type: string, tag?: string | null): string | null {
  const ofType = hashes?.[type];
  if (!ofType) return null;
  const hash = (tag && ofType[tag]) || Object.values(ofType)[0];
  return blurhashAverageColor(hash);
}
