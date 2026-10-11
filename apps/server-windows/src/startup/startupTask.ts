/**
 * « Démarrer avec Windows » dans le paquet MSIX : la `StartupTask` déclarée
 * par le manifeste (`windows.startupTask`, `TaskId` ci-dessous — le fil D le
 * reprend tel quel), lue et réglée par WinRT, atteint par koffi comme le fait
 * déjà `apps/desktop-electron/src/main/winrt/com.ts`.
 *
 * Elle part à l'OUVERTURE DE SESSION, pas à l'allumage (limite acceptée,
 * diagnostic § 1). L'utilisateur garde la main dans Paramètres > Démarrage :
 * `DisabledByUser` ne se force pas, on l'y renvoie.
 *
 * Fentes de vtable relevées dans `windows.applicationmodel.h` (SDK 26100),
 * jamais devinées : `IStartupTaskStatics::GetAsync` = 7 ;
 * `IStartupTask::RequestEnableAsync` = 6, `Disable` = 7, `get_State` = 8 ;
 * `IAsyncOperation<T>::GetResults` = 8 ; `IAsyncInfo::get_Status` = 7.
 *
 * ⚠️ Ne se charge que sous Windows, et ne marche qu'avec une identité de paquet.
 */
import koffi from "koffi";
import type { StartupState } from "../tray/menuModel";
import { IID, guidBuffer } from "../winrt/guid";

export const STARTUP_TASK_ID = "TentacleServerStartup";

const combase = koffi.load("combase.dll");
const RoInitialize = combase.func("long RoInitialize(int initType)");
const RoGetActivationFactory = combase.func("long RoGetActivationFactory(void *classId, const void *iid, _Out_ void **factory)");
const WindowsCreateString = combase.func("long WindowsCreateString(const char16_t *src, uint32 len, _Out_ void **out)");
const WindowsDeleteString = combase.func("long WindowsDeleteString(void *hstring)");

const QueryInterface = koffi.proto("long TentacleQueryInterface(void *self, const void *iid, _Out_ void **out)");
const Release = koffi.proto("unsigned long TentacleRelease(void *self)");
const GetPtr = koffi.proto("long TentacleGetPtr(void *self, _Out_ void **value)");
const GetInt32 = koffi.proto("long TentacleGetInt32(void *self, _Out_ int32 *value)");
const WithPtr = koffi.proto("long TentacleWithPtr(void *self, void *arg, _Out_ void **out)");
const NoArgs = koffi.proto("long TentacleNoArgs(void *self)");

const STATES: Record<number, StartupState> = {
  0: "disabled",
  1: "disabled-by-user",
  2: "enabled",
  3: "disabled-by-policy",
  4: "enabled-by-policy",
};

let initialized = false;

function slot(iface: unknown, index: number): unknown {
  const vtable = koffi.decode(iface, "void *");
  return koffi.decode(vtable, index * 8, "void *");
}

function release(iface: unknown): void {
  if (iface) koffi.call(slot(iface, 2), Release, iface);
}

function pointerAt(iface: unknown, index: number): unknown {
  const out: unknown[] = [null];
  return (koffi.call(slot(iface, index), GetPtr, iface, out) as number) === 0 ? out[0] : null;
}

function int32At(iface: unknown, index: number): number | null {
  const out = [0];
  return (koffi.call(slot(iface, index), GetInt32, iface, out) as number) === 0 ? (out[0] ?? 0) : null;
}

/** Attend la fin d'une opération WinRT en sondant son état, sans bloquer la boucle. */
async function completed(operation: unknown, timeoutMs: number): Promise<boolean> {
  const out: unknown[] = [null];
  const code = koffi.call(slot(operation, 0), QueryInterface, operation, guidBuffer(IID.asyncInfo), out) as number;
  if (code !== 0 || !out[0]) return false;
  const info = out[0];
  try {
    const limit = Date.now() + timeoutMs;
    for (;;) {
      const status = int32At(info, 7);
      if (status === null) return false;
      if (status !== 0) return status === 1;
      if (Date.now() > limit) return false;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  } finally {
    release(info);
  }
}

/** La `StartupTask` de ce paquet ; `null` hors paquet ou si le manifeste ne la déclare pas. */
async function startupTask(): Promise<unknown> {
  if (!initialized) {
    initialized = true;
    RoInitialize(0);
  }
  const className = "Windows.ApplicationModel.StartupTask";
  const classId: unknown[] = [null];
  const taskId: unknown[] = [null];
  WindowsCreateString(className, className.length, classId);
  WindowsCreateString(STARTUP_TASK_ID, STARTUP_TASK_ID.length, taskId);
  const factory: unknown[] = [null];
  try {
    if ((RoGetActivationFactory(classId[0], guidBuffer(IID.startupTaskStatics), factory) as number) !== 0) return null;
    const operation: unknown[] = [null];
    if ((koffi.call(slot(factory[0], 7), WithPtr, factory[0], taskId[0], operation) as number) !== 0) return null;
    try {
      return (await completed(operation[0], 10_000)) ? pointerAt(operation[0], 8) : null;
    } finally {
      release(operation[0]);
    }
  } finally {
    release(factory[0]);
    WindowsDeleteString(classId[0]);
    WindowsDeleteString(taskId[0]);
  }
}

export async function readStartupTask(): Promise<StartupState> {
  const task = await startupTask();
  if (!task) return "unavailable";
  try {
    return STATES[int32At(task, 8) ?? -1] ?? "unavailable";
  } finally {
    release(task);
  }
}

export async function setStartupTask(enabled: boolean): Promise<StartupState> {
  const task = await startupTask();
  if (!task) return "unavailable";
  try {
    if (!enabled) {
      koffi.call(slot(task, 7), NoArgs, task);
      return STATES[int32At(task, 8) ?? -1] ?? "unavailable";
    }
    const operation = pointerAt(task, 6);
    if (!operation) return "unavailable";
    try {
      // `GetResults` d'un `IAsyncOperation<StartupTaskState>` rend l'énumération elle-même.
      return (await completed(operation, 30_000)) ? (STATES[int32At(operation, 8) ?? -1] ?? "unavailable") : "unavailable";
    } finally {
      release(operation);
    }
  } finally {
    release(task);
  }
}
