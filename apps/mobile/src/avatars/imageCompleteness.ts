/**
 * Une image GARDÉE par le cache disque est-elle entière ? Règle PURE (`imageCompleteness.test.ts`).
 *
 * Relevé du banc mo2 (28/10) : la photo de Knaoxtest s'affichait rognée — seule la bande du haut, le reste
 * noir — dans le hub d'Octave ET dans le profil de Tentacle. Jellyfin et le proxy la servaient entière
 * (556 450 octets, même en lectures concurrentes) ; c'est le cache disque d'expo-image (SDWebImage) qui en
 * gardait 139 264 octets, sans fin de PNG. L'URL de la photo est immuable (son étiquette) : sans réparation,
 * l'image tronquée ne repart jamais. Le décodeur ne signale rien (il dessine ce qu'il a), d'où ce contrôle.
 *
 * Seuls les formats qu'on sait clore sont jugés (PNG, JPEG, WebP, GIF) ; tout autre est tenu pour entier.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** Le bloc IEND, vide, et son CRC fixe. */
const PNG_END = [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];

function startsWith(bytes: Uint8Array, prefix: readonly number[], at = 0): boolean {
  if (bytes.length < at + prefix.length) return false;
  return prefix.every((value, i) => bytes[at + i] === value);
}

function endsWith(bytes: Uint8Array, suffix: readonly number[]): boolean {
  return startsWith(bytes, suffix, bytes.length - suffix.length);
}

/** Les octets d'une image se terminent-ils là où leur format le dit ? */
export function imageBytesComplete(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  if (startsWith(bytes, PNG_SIGNATURE)) return endsWith(bytes, PNG_END);
  if (startsWith(bytes, [0xff, 0xd8])) {
    // Un JPEG finit par EOI (FF D9) ; quelques encodeurs laissent des octets nuls derrière.
    let end = bytes.length;
    while (end > 2 && bytes[end - 1] === 0) end -= 1;
    return bytes[end - 2] === 0xff && bytes[end - 1] === 0xd9;
  }
  // RIFF <taille LE> WEBP : la taille annoncée couvre tout le fichier après ses 8 premiers octets.
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    const size = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
    return bytes.length >= size + 8;
  }
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return bytes[bytes.length - 1] === 0x3b;
  return true;
}
