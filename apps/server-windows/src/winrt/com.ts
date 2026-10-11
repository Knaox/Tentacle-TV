/**
 * Le strict nécessaire pour parler à WinRT depuis l'hôte, par koffi : une
 * interface COM est un pointeur vers une table de pointeurs de fonction ; on
 * lit la fente voulue (relevée dans les en-têtes du SDK, jamais devinée) et on
 * l'appelle. Jumeau réduit de `apps/desktop-electron/src/main/winrt/com.ts`.
 *
 * L'attente d'une opération asynchrone SONDE son état par la boucle
 * d'évènements : l'hôte continue de pomper les messages de son icône (le
 * dialogue du Store en a besoin) et de suivre le serveur pendant ce temps.
 *
 * ⚠️ Ne se charge que sous Windows : `koffi.load` s'exécute à l'import.
 */
import koffi from "koffi";
import { IID, guidBuffer } from "./guid";

const combase = koffi.load("combase.dll");

/** Un pointeur d'interface COM, opaque. */
export type ComPtr = unknown;

const S_OK = 0;
/** `AsyncStatus` de WinRT. */
const STARTED = 0;
const COMPLETED = 1;
/** `IAsyncInfo::get_Status`, `asyncinfo.h`. */
const SLOT_ASYNC_STATUS = 7;

const RoInitialize = combase.func("long RoInitialize(int initType)");
const RoGetActivationFactory = combase.func("long RoGetActivationFactory(void *classId, const void *iid, _Out_ void **factory)");
const WindowsCreateString = combase.func("long WindowsCreateString(const char16_t *src, uint32 len, _Out_ void **out)");
const WindowsDeleteString = combase.func("long WindowsDeleteString(void *hstring)");

const QueryInterfaceProto = koffi.proto("long HostComQueryInterface(void *self, const void *iid, _Out_ void **out)");
const ReleaseProto = koffi.proto("unsigned long HostComRelease(void *self)");
const GetInt32Proto = koffi.proto("long HostComGetInt32(void *self, _Out_ int32 *value)");
const GetPtrProto = koffi.proto("long HostComGetPtr(void *self, _Out_ void **value)");
const GetBoolProto = koffi.proto("long HostComGetBool(void *self, _Out_ uint8 *value)");
const CallPtrProto = koffi.proto("long HostComCallPtr(void *self, void *arg, _Out_ void **out)");
const WithPtrProto = koffi.proto("long HostComWithPtr(void *self, void *arg)");
const GetAtProto = koffi.proto("long HostComGetAt(void *self, uint32 index, _Out_ void **item)");

let initialized = false;

/** `RPC_E_CHANGED_MODE` (un apartment déjà posé) n'est pas une erreur : on continue. */
function ensureWinRt(): void {
  if (initialized) return;
  initialized = true;
  RoInitialize(0);
}

function slot(iface: ComPtr, index: number): ComPtr {
  const vtable = koffi.decode(iface, "void *") as ComPtr;
  return koffi.decode(vtable, index * 8, "void *") as ComPtr;
}

export function queryInterface(iface: ComPtr, iid: string | Buffer): ComPtr | null {
  const out: ComPtr[] = [null];
  const bytes = typeof iid === "string" ? guidBuffer(iid) : iid;
  const code = koffi.call(slot(iface, 0), QueryInterfaceProto, iface, bytes, out) as number;
  return code === S_OK ? (out[0] ?? null) : null;
}

export function release(iface: ComPtr | null): void {
  if (iface === null || iface === undefined) return;
  koffi.call(slot(iface, 2), ReleaseProto, iface);
}

/** Fabrique d'activation d'une classe WinRT ; `null` si elle est absente (hors paquet, vieux Windows). */
export function activationFactory(className: string, iid: string): ComPtr | null {
  ensureWinRt();
  const hstring: ComPtr[] = [null];
  if ((WindowsCreateString(className, className.length, hstring) as number) !== S_OK) return null;
  try {
    const out: ComPtr[] = [null];
    return (RoGetActivationFactory(hstring[0], guidBuffer(iid), out) as number) === S_OK ? (out[0] ?? null) : null;
  } finally {
    WindowsDeleteString(hstring[0]);
  }
}

export function callForPointer(iface: ComPtr, index: number): ComPtr | null {
  const out: ComPtr[] = [null];
  return (koffi.call(slot(iface, index), GetPtrProto, iface, out) as number) === S_OK ? (out[0] ?? null) : null;
}

export function callWithPointer(iface: ComPtr, index: number, arg: ComPtr): ComPtr | null {
  const out: ComPtr[] = [null];
  return (koffi.call(slot(iface, index), CallPtrProto, iface, arg, out) as number) === S_OK ? (out[0] ?? null) : null;
}

/** Une fente qui prend un pointeur et ne rend que son code (`IInitializeWithWindow::Initialize`). */
export function callTakingPointer(iface: ComPtr, index: number, arg: ComPtr): boolean {
  return (koffi.call(slot(iface, index), WithPtrProto, iface, arg) as number) === S_OK;
}

export function callForInt32(iface: ComPtr, index: number): number | null {
  const out = [0];
  return (koffi.call(slot(iface, index), GetInt32Proto, iface, out) as number) === S_OK ? (out[0] ?? 0) : null;
}

export function callForBoolean(iface: ComPtr, index: number): boolean | null {
  const out = [0];
  return (koffi.call(slot(iface, index), GetBoolProto, iface, out) as number) === S_OK ? (out[0] ?? 0) !== 0 : null;
}

/** `IVectorView<T>::get_Size`, fente 7 (`windows.foundation.collections.h`). */
export function vectorSize(vector: ComPtr): number | null {
  return callForInt32(vector, 7);
}

/** `IVectorView<T>::GetAt`, fente 6. */
export function vectorGetAt(vector: ComPtr, index: number): ComPtr | null {
  const out: ComPtr[] = [null];
  return (koffi.call(slot(vector, 6), GetAtProto, vector, index, out) as number) === S_OK ? (out[0] ?? null) : null;
}

/**
 * Attend la fin d'une opération, SANS bloquer, puis rend son résultat :
 * `resultSlot` vaut 8 pour `IAsyncOperation<T>`, 10 pour la variante à
 * progression.
 */
export async function awaitOperation(operation: ComPtr, resultSlot: number, timeoutMs: number): Promise<ComPtr | null> {
  const info = queryInterface(operation, IID.asyncInfo);
  if (info === null) return null;
  try {
    const limit = Date.now() + timeoutMs;
    for (;;) {
      const status = callForInt32(info, SLOT_ASYNC_STATUS);
      if (status === null) return null;
      if (status !== STARTED) return status === COMPLETED ? callForPointer(operation, resultSlot) : null;
      if (Date.now() > limit) return null;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  } finally {
    release(info);
  }
}
