/**
 * Le strict nécessaire pour parler à WinRT depuis le processus principal.
 *
 * # Pourquoi c'est faisable
 *
 * koffi sait appeler un pointeur de fonction arbitraire — `koffi.call(ptr,
 * proto, …)`. Une interface COM n'est rien d'autre qu'un pointeur vers une
 * table de tels pointeurs : la lire à l'indice voulu et l'appeler suffit. Les
 * indices ne sont PAS devinés, ils sont relevés dans les en-têtes du SDK
 * Windows, et notés à côté de chaque constante.
 *
 * # Pourquoi l'attente ne bloque JAMAIS
 *
 * Le thread principal d'Electron vit dans un apartment STA : il doit pomper sa
 * file de messages pour que WinRT lui livre ses réponses, et pour que la boîte
 * de dialogue du Store puisse seulement s'afficher. Une attente bloquante
 * l'empêcherait — la complétion n'arriverait donc jamais, et l'application
 * paraîtrait figée pour de bon. On SONDE l'état par la boucle d'évènements,
 * ce qui laisse tout tourner.
 */

import koffi from "koffi";
import { guidBuffer, IID } from "./guid";

const combase = koffi.load("combase.dll");

export const S_OK = 0;

/** Un pointeur d'interface COM. Opaque de bout en bout. */
export type ComPtr = unknown;

/** `AsyncStatus` de WinRT. */
const STARTED = 0;
const COMPLETED = 1;

/** Fentes communes à toute interface COM ou WinRT. */
const SLOT_QUERY_INTERFACE = 0;
const SLOT_RELEASE = 2;
/** `IAsyncInfo::get_Status` — en-tête `asyncinfo.h`. */
const SLOT_ASYNC_STATUS = 7;

const RoInitialize = combase.func("long __stdcall RoInitialize(int initType)");
const RoGetActivationFactory = combase.func(
  "long __stdcall RoGetActivationFactory(void *classId, const void *iid, _Out_ void **factory)",
);
const WindowsCreateString = combase.func(
  "long __stdcall WindowsCreateString(const char16_t *src, uint32_t len, _Out_ void **out)",
);
const WindowsDeleteString = combase.func("long __stdcall WindowsDeleteString(void *hstring)");

const QueryInterfaceProto = koffi.proto(
  "long __stdcall QueryInterface(void *self, const void *iid, _Out_ void **out)",
);
const ReleaseProto = koffi.proto("unsigned long __stdcall Release(void *self)");
const GetUint32Proto = koffi.proto("long __stdcall GetUint32(void *self, _Out_ uint32_t *value)");
const GetInt32Proto = koffi.proto("long __stdcall GetInt32(void *self, _Out_ int32_t *value)");
const GetPtrProto = koffi.proto("long __stdcall GetPtr(void *self, _Out_ void **value)");
const GetBoolProto = koffi.proto("long __stdcall GetBool(void *self, _Out_ uint8_t *value)");
const GetAtProto = koffi.proto(
  "long __stdcall GetAt(void *self, uint32_t index, _Out_ void **item)",
);
const CallPtrProto = koffi.proto(
  "long __stdcall CallPtr(void *self, void *arg, _Out_ void **out)",
);
// Le descripteur de fenêtre passe en `uint64` et non en `void *` : koffi rend
// les entiers de cette largeur en Number ou BigInt, et c'est la forme que la
// couche Win32 de ce projet manipule déjà (`video/win32.ts`).
const WithHandleProto = koffi.proto("long __stdcall WithHandle(void *self, uint64 handle)");

let initialized = false;

/**
 * Prépare le thread pour WinRT. Idempotent, et TOLÉRANT à l'échec.
 *
 * `RPC_E_CHANGED_MODE` signifie que le thread a déjà un apartment — celui de
 * Chromium. C'est le cas nominal ici, et ce n'est pas une erreur : on continue.
 */
export function ensureWinRt(): void {
  if (initialized) return;
  initialized = true;
  // 0 = mono-thread (STA), ce que le thread principal d'Electron est déjà.
  RoInitialize(0);
}

/** La fente `index` de la vtable d'une interface. */
function slot(iface: ComPtr, index: number): ComPtr {
  const vtable = koffi.decode(iface, "void *") as ComPtr;
  return koffi.decode(vtable, index * 8, "void *") as ComPtr;
}

/** `IUnknown::QueryInterface`. `null` si l'interface n'est pas là. */
export function queryInterface(iface: ComPtr, iid: string | Buffer): ComPtr | null {
  const out: ComPtr[] = [null];
  const bytes = typeof iid === "string" ? guidBuffer(iid) : iid;
  const code = koffi.call(slot(iface, SLOT_QUERY_INTERFACE), QueryInterfaceProto, iface, bytes, out) as number;
  return code === S_OK ? (out[0] ?? null) : null;
}

/** `IUnknown::Release`. Sans effet sur `null` — l'appelant n'a rien à vérifier. */
export function release(iface: ComPtr | null): void {
  if (iface === null || iface === undefined) return;
  koffi.call(slot(iface, SLOT_RELEASE), ReleaseProto, iface);
}

/** Fabrique d'activation d'une classe WinRT. `null` si elle est absente. */
export function activationFactory(className: string, iid: string): ComPtr | null {
  ensureWinRt();
  const hstring: ComPtr[] = [null];
  if ((WindowsCreateString(className, className.length, hstring) as number) !== S_OK) return null;
  try {
    const out: ComPtr[] = [null];
    const code = RoGetActivationFactory(hstring[0], guidBuffer(iid), out) as number;
    return code === S_OK ? (out[0] ?? null) : null;
  } finally {
    WindowsDeleteString(hstring[0]);
  }
}

/** Appelle une fente qui rend un pointeur (`_Out_ void **`). */
export function callForPointer(iface: ComPtr, index: number): ComPtr | null {
  const out: ComPtr[] = [null];
  const code = koffi.call(slot(iface, index), GetPtrProto, iface, out) as number;
  return code === S_OK ? (out[0] ?? null) : null;
}

/** Appelle une fente qui prend un pointeur et en rend un. */
export function callWithPointer(iface: ComPtr, index: number, arg: ComPtr): ComPtr | null {
  const out: ComPtr[] = [null];
  const code = koffi.call(slot(iface, index), CallPtrProto, iface, arg, out) as number;
  return code === S_OK ? (out[0] ?? null) : null;
}

/** Appelle une fente qui rend un entier non signé. */
export function callForUint32(iface: ComPtr, index: number): number | null {
  const out = [0];
  const code = koffi.call(slot(iface, index), GetUint32Proto, iface, out) as number;
  return code === S_OK ? (out[0] ?? 0) : null;
}

/** Appelle une fente qui rend un entier signé (une énumération, en pratique). */
export function callForInt32(iface: ComPtr, index: number): number | null {
  const out = [0];
  const code = koffi.call(slot(iface, index), GetInt32Proto, iface, out) as number;
  return code === S_OK ? (out[0] ?? 0) : null;
}

/** Appelle une fente qui rend un booléen WinRT (un octet). */
export function callForBoolean(iface: ComPtr, index: number): boolean | null {
  const out = [0];
  const code = koffi.call(slot(iface, index), GetBoolProto, iface, out) as number;
  return code === S_OK ? (out[0] ?? 0) !== 0 : null;
}

/** Appelle une fente qui prend un descripteur de fenêtre. */
export function callWithHandle(iface: ComPtr, index: number, handle: bigint): boolean {
  return (koffi.call(slot(iface, index), WithHandleProto, iface, handle) as number) === S_OK;
}

/** `IVectorView<T>::GetAt` — fente 6, en-tête `windows.foundation.collections.h`. */
export function vectorGetAt(vector: ComPtr, index: number): ComPtr | null {
  const out: ComPtr[] = [null];
  const code = koffi.call(slot(vector, 6), GetAtProto, vector, index, out) as number;
  return code === S_OK ? (out[0] ?? null) : null;
}

/**
 * Attend la fin d'une opération asynchrone, SANS bloquer, puis rend son
 * résultat.
 *
 * `resultSlot` diffère selon l'interface : 8 pour `IAsyncOperation<T>`, 10 pour
 * `IAsyncOperationWithProgress<T, P>` — relevé dans
 * `windows.foundation.collections.h`.
 */
export async function awaitOperation(
  operation: ComPtr,
  resultSlot: number,
  timeoutMs: number,
): Promise<ComPtr | null> {
  const info = queryInterface(operation, IID.asyncInfo);
  if (info === null) return null;
  try {
    const limit = Date.now() + timeoutMs;
    for (;;) {
      const status = callForInt32(info, SLOT_ASYNC_STATUS);
      if (status === null) return null;
      if (status !== STARTED) {
        return status === COMPLETED ? callForPointer(operation, resultSlot) : null;
      }
      if (Date.now() > limit) return null;
      // 100 ms : assez fin pour ne pas se faire attendre, assez large pour ne
      // rien coûter. La boucle d'évènements continue de tourner entre deux.
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } finally {
    release(info);
  }
}
