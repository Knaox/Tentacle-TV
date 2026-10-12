/**
 * Le sous-système d'un exécutable PE, lu et réécrit sur place.
 *
 * `node.exe` est un programme CONSOLE : lancé par le menu Démarrer ou la tâche
 * de démarrage, il ouvrirait une fenêtre noire. Passé en sous-système GUI, il
 * n'en ouvre aucune — le serveur qu'il lance non plus (`windowsHide`) — et
 * reste le même Node (`fork`, yt-dlp et `process.execPath` en dépendent).
 *
 * Le champ vit à 68 octets du début de l'en-tête optionnel, en PE32 comme en
 * PE32+ (`winnt.h`, `IMAGE_OPTIONAL_HEADER64::Subsystem`). La somme de
 * contrôle de l'en-tête n'est pas vérifiée pour un exe en mode utilisateur ;
 * la signature Authenticode de nodejs.org tombe, celle du paquet MSIX la
 * remplace.
 */

export const SUBSYSTEM = { GUI: 2, CONSOLE: 3 } as const;

const PE_SIGNATURE = 0x00004550; // « PE\0\0 »
const OPTIONAL_MAGIC = { PE32: 0x10b, PE32_PLUS: 0x20b } as const;
const SUBSYSTEM_OFFSET = 68;

function subsystemOffset(image: Buffer): number {
  if (image.length < 0x40 || image.readUInt16LE(0) !== 0x5a4d) throw new Error("pas un exécutable (MZ absent)");
  const peOffset = image.readUInt32LE(0x3c);
  if (peOffset + 24 + SUBSYSTEM_OFFSET + 2 > image.length || image.readUInt32LE(peOffset) !== PE_SIGNATURE) {
    throw new Error("en-tête PE introuvable");
  }
  const optional = peOffset + 24;
  const magic = image.readUInt16LE(optional);
  if (magic !== OPTIONAL_MAGIC.PE32 && magic !== OPTIONAL_MAGIC.PE32_PLUS) {
    throw new Error(`en-tête optionnel inconnu (0x${magic.toString(16)})`);
  }
  return optional + SUBSYSTEM_OFFSET;
}

export function readSubsystem(image: Buffer): number {
  return image.readUInt16LE(subsystemOffset(image));
}

/** Réécrit le sous-système ; rend l'ancien. */
export function setSubsystem(image: Buffer, subsystem: number): number {
  const offset = subsystemOffset(image);
  const previous = image.readUInt16LE(offset);
  image.writeUInt16LE(subsystem, offset);
  return previous;
}
