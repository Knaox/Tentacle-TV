/**
 * Un GUID en ses 16 octets, prêts pour un appel COM, et l'IID calculé d'une
 * interface générique. Jumeau de `apps/desktop-electron/src/main/winrt/guid.ts`
 * (l'hôte ne peut pas importer la coquille Electron).
 */
import { createHash } from "node:crypto";

/** Les identifiants d'interface dont l'hôte a besoin, relevés dans le SDK Windows (10.0.26100). */
export const IID = {
  /** `asyncinfo.h`. */
  asyncInfo: "00000036-0000-0000-C000-000000000046",
  /** `windows.applicationmodel.h`. */
  startupTaskStatics: "ee5b60bd-a148-41a7-b26e-e8b88a1e62f8",
  /** `IInitializeWithWindow`, `shobjidl_core.h`. */
  initializeWithWindow: "3E68D4BD-7135-4D10-8018-9FB6D9F33FA1",
  /** `windows.services.store.h` : `IStoreContextStatics`. */
  storeContextStatics: "9C06EE5F-15C0-4E72-9330-D6191CEBD19C",
  /** `windows.services.store.h` : `IStoreContext3` (Windows 10 1803), la voie silencieuse. */
  storeContext3: "E26226CA-1A01-4730-85A6-ECC896E4AE38",
} as const;

/** Espace de noms des interfaces paramétrées, fixé par la spécification WinRT. */
const PINTERFACE_NAMESPACE = "11f47ad5-7b73-42c0-abae-878b1e16adee";

/** `IIterable<StorePackageUpdate>` : `{faa585ea-…}` = `IIterable<T>`, puis la classe par son interface par défaut. */
export const IITERABLE_STORE_PACKAGE_UPDATE_SIGNATURE =
  "pinterface({faa585ea-6214-4217-afda-7f46de5869b3};" +
  "rc(Windows.Services.Store.StorePackageUpdate;{140fa150-3cbf-4a35-b91f-48271c31b072}))";

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

/**
 * IID d'une interface générique instanciée : UUID v5 sur sa signature. Le
 * résultat est éprouvé à l'exécution par `QueryInterface`, qui refuse un GUID
 * faux au lieu de le laisser passer.
 */
export function parameterizedIid(signature: string): Buffer {
  const seed = Buffer.concat([Buffer.from(PINTERFACE_NAMESPACE.replace(/-/g, ""), "hex"), Buffer.from(signature, "utf8")]);
  const bytes = Buffer.from(createHash("sha1").update(seed).digest().subarray(0, 16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  // Le condensé est en GROS-boutiste ; l'ABI attend les trois premiers champs en petit-boutiste.
  return Buffer.concat([
    Buffer.from([bytes[3] ?? 0, bytes[2] ?? 0, bytes[1] ?? 0, bytes[0] ?? 0]),
    Buffer.from([bytes[5] ?? 0, bytes[4] ?? 0]),
    Buffer.from([bytes[7] ?? 0, bytes[6] ?? 0]),
    bytes.subarray(8),
  ]);
}
