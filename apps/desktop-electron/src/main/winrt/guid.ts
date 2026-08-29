/**
 * Identifiants d'interface COM et WinRT.
 *
 * # Les deux sortes d'IID
 *
 * La plupart sont des constantes, lisibles dans les en-têtes du SDK Windows.
 * Mais une interface GÉNÉRIQUE — `IIterable<StorePackageUpdate>` — n'a pas
 * d'IID écrit nulle part : il est CALCULÉ à partir du type paramétré, par un
 * UUID v5 sur une signature normalisée. Le SDK le déclare `EXTERN_C const IID`
 * et le définit dans une bibliothèque, hors de portée d'un pont FFI.
 *
 * L'algorithme est celui de la spécification WinRT. On ne le prend pas pour
 * argent comptant : le résultat est éprouvé à l'exécution par un
 * `QueryInterface`, qui refuse un GUID faux au lieu de le laisser passer.
 */

import { createHash } from "node:crypto";

/** Espace de noms des interfaces paramétrées, fixé par la spécification. */
const PINTERFACE_NAMESPACE = "11f47ad5-7b73-42c0-abae-878b1e16adee";

/** Convertit `{xxxxxxxx-xxxx-...}` en ses 16 octets, prêts pour un appel COM. */
export function guidBuffer(text: string): Buffer {
  const hex = text.replace(/[{}-]/g, "");
  if (hex.length !== 32) throw new Error(`GUID invalide : ${text}`);
  const bytes = Buffer.alloc(16);
  // Les trois premiers champs sont des ENTIERS, donc en petit-boutiste ; les
  // huit derniers octets sont bruts. C'est le piège classique du GUID.
  bytes.writeUInt32LE(Number.parseInt(hex.slice(0, 8), 16), 0);
  bytes.writeUInt16LE(Number.parseInt(hex.slice(8, 12), 16), 4);
  bytes.writeUInt16LE(Number.parseInt(hex.slice(12, 16), 16), 6);
  Buffer.from(hex.slice(16), "hex").copy(bytes, 8);
  return bytes;
}

/**
 * IID d'une interface générique instanciée, par UUID v5.
 *
 * `signature` est la signature du type paramétré, par exemple
 * `pinterface({faa585ea-…};rc(Windows.Services.Store.StorePackageUpdate;{140fa150-…}))`.
 */
export function parameterizedIid(signature: string): Buffer {
  const seed = Buffer.concat([
    guidBufferBigEndian(PINTERFACE_NAMESPACE),
    Buffer.from(signature, "utf8"),
  ]);
  const digest = createHash("sha1").update(seed).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  // Version 5 et variante RFC 4122, comme pour tout UUID nommé.
  const byte6 = bytes[6] ?? 0;
  const byte8 = bytes[8] ?? 0;
  bytes[6] = (byte6 & 0x0f) | 0x50;
  bytes[8] = (byte8 & 0x3f) | 0x80;
  // Le condensé est en GROS-boutiste ; l'ABI attend les trois premiers champs
  // en petit-boutiste.
  return Buffer.concat([
    Buffer.from([bytes[3] ?? 0, bytes[2] ?? 0, bytes[1] ?? 0, bytes[0] ?? 0]),
    Buffer.from([bytes[5] ?? 0, bytes[4] ?? 0]),
    Buffer.from([bytes[7] ?? 0, bytes[6] ?? 0]),
    bytes.subarray(8),
  ]);
}

/** Les 16 octets d'un GUID en gros-boutiste — la forme qu'attend le condensé. */
function guidBufferBigEndian(text: string): Buffer {
  const hex = text.replace(/[{}-]/g, "");
  return Buffer.from(hex, "hex");
}

/** Interfaces dont l'IID est écrit noir sur blanc dans les en-têtes du SDK. */
export const IID = {
  /** `IActivationFactory` — la porte d'entrée de toute classe WinRT. */
  activationFactory: "00000035-0000-0000-C000-000000000046",
  /** `IAsyncInfo` — l'état d'une opération asynchrone. */
  asyncInfo: "00000036-0000-0000-C000-000000000046",
  /** `IInitializeWithWindow` — rattache une API WinRT à une fenêtre Win32. */
  initializeWithWindow: "3E68D4BD-7135-4D10-8018-9FB6D9F33FA1",
  /** `Windows.Services.Store.IStoreContextStatics`. Confirmé par sondage. */
  storeContextStatics: "9C06EE5F-15C0-4E72-9330-D6191CEBD19C",
  /** `Windows.Services.Store.IStorePackageUpdate`. */
  storePackageUpdate: "140FA150-3CBF-4A35-B91F-48271C31B072",
} as const;

/**
 * `IIterable<StorePackageUpdate>`, l'unique IID qu'il faut calculer.
 *
 * `{faa585ea-…}` est l'IID de l'interface générique `IIterable<T>` ;
 * `rc(...)` décrit la classe d'exécution par son interface par défaut.
 */
export const IITERABLE_STORE_PACKAGE_UPDATE_SIGNATURE =
  "pinterface({faa585ea-6214-4217-afda-7f46de5869b3};" +
  "rc(Windows.Services.Store.StorePackageUpdate;{140fa150-3cbf-4a35-b91f-48271c31b072}))";
