/**
 * Un GUID en ses 16 octets, prêts pour un appel COM. Jumeau de
 * `apps/desktop-electron/src/main/winrt/guid.ts` (l'hôte ne peut pas importer
 * la coquille Electron) — sans le calcul des IID paramétrés, inutile ici.
 */

/** Les identifiants d'interface dont l'hôte a besoin, relevés dans le SDK Windows. */
export const IID = {
  /** `asyncinfo.h`. */
  asyncInfo: "00000036-0000-0000-C000-000000000046",
  /** `windows.applicationmodel.h`, 10.0.26100. */
  startupTaskStatics: "ee5b60bd-a148-41a7-b26e-e8b88a1e62f8",
} as const;

export function guidBuffer(text: string): Buffer {
  const hex = text.replace(/[{}-]/g, "");
  if (hex.length !== 32) throw new Error(`GUID invalide : ${text}`);
  const bytes = Buffer.alloc(16);
  // Les trois premiers champs sont des ENTIERS (petit-boutiste), les huit
  // derniers octets sont bruts : le piège classique du GUID.
  bytes.writeUInt32LE(Number.parseInt(hex.slice(0, 8), 16), 0);
  bytes.writeUInt16LE(Number.parseInt(hex.slice(8, 12), 16), 4);
  bytes.writeUInt16LE(Number.parseInt(hex.slice(12, 16), 16), 6);
  Buffer.from(hex.slice(16), "hex").copy(bytes, 8);
  return bytes;
}
