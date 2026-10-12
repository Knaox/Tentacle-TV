/**
 * La boîte « Choisir un dossier » de l'Explorateur (`IFileOpenDialog` en mode
 * `FOS_PICKFOLDERS`), atteinte par koffi comme le reste de l'hôte.
 *
 * Elle ne tourne JAMAIS dans l'hôte : `Show` est une boucle modale qui
 * bloquerait son fil — plus d'icône, et surtout plus de lecture des journaux
 * du serveur, dont les tubes pleins figeraient le serveur lui-même. L'hôte
 * relance donc son propre exécutable en mode `--pick-folder`
 * (`pickFolderProcess.ts`), qui n'appelle que ce fichier, écrit le résultat
 * sur sa sortie, et s'en va.
 *
 * La boîte a pour propriétaire une petite fenêtre cachée AU PREMIER PLAN :
 * lancée par un processus qui n'a pas la main, elle passerait sinon derrière
 * le navigateur. Un lecteur MAPPÉ est rendu avec son chemin réseau
 * (`WNetGetConnectionW`) : Jellyfin en service ne le voit pas sous sa lettre.
 *
 * Fentes de vtable relevées dans `shobjidl_core.h` (SDK 26100) : IModalWindow
 * `Show` = 3 ; IFileDialog `SetOptions` = 9, `GetOptions` = 10, `SetFolder` = 12,
 * `SetTitle` = 17, `GetResult` = 20 ; IShellItem `GetDisplayName` = 5.
 *
 * ⚠️ Ne se charge que sous Windows : `koffi.load` s'exécute à l'import.
 */
import koffi from "koffi";
import type { PickFolderParams, PickFolderResult } from "../protocol";
import { guidBuffer } from "../winrt/guid";

const ole32 = koffi.load("ole32.dll");
const shell32 = koffi.load("shell32.dll");
const user32 = koffi.load("user32.dll");
const kernel32 = koffi.load("kernel32.dll");
const mpr = koffi.load("mpr.dll");

const CoInitializeEx = ole32.func("long CoInitializeEx(void *reserved, uint32 coinit)");
const CoCreateInstance = ole32.func("long CoCreateInstance(const void *clsid, void *outer, uint32 context, const void *iid, _Out_ void **out)");
const CoTaskMemFree = ole32.func("void CoTaskMemFree(void *memory)");
const SHCreateItemFromParsingName = shell32.func("long SHCreateItemFromParsingName(const char16_t *path, void *bind, const void *iid, _Out_ void **out)");
const CreateWindowExW = user32.func(
  "void *CreateWindowExW(uint32 exStyle, const char16_t *cls, const char16_t *title, uint32 style, int x, int y, int w, int h, void *parent, void *menu, void *instance, void *param)",
);
const DestroyWindow = user32.func("int DestroyWindow(void *hwnd)");
const GetSystemMetrics = user32.func("int GetSystemMetrics(int index)");
const SetForegroundWindow = user32.func("int SetForegroundWindow(void *hwnd)");
const SetProcessDpiAwarenessContext = user32.func("int SetProcessDpiAwarenessContext(intptr_t context)");
const GetDriveTypeW = kernel32.func("uint32 GetDriveTypeW(const char16_t *root)");
const WNetGetConnectionW = mpr.func("uint32 WNetGetConnectionW(const char16_t *local, _Out_ uint8_t *remote, _Inout_ uint32 *length)");

const Release = koffi.proto("unsigned long TentacleDialogRelease(void *self)");
const Show = koffi.proto("long TentacleDialogShow(void *self, void *owner)");
const SetOptions = koffi.proto("long TentacleDialogSetOptions(void *self, uint32 options)");
const GetOptions = koffi.proto("long TentacleDialogGetOptions(void *self, _Out_ uint32 *options)");
const WithPtr = koffi.proto("long TentacleDialogWithPtr(void *self, void *value)");
const SetTitle = koffi.proto("long TentacleDialogSetTitle(void *self, const char16_t *title)");
const GetPtr = koffi.proto("long TentacleDialogGetPtr(void *self, _Out_ void **out)");
const GetDisplayName = koffi.proto("long TentacleItemGetDisplayName(void *self, uint32 sigdn, _Out_ void **name)");

const CLSID_FILE_OPEN_DIALOG = "DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7";
const IID_FILE_OPEN_DIALOG = "D57C7288-D4AD-4768-BE02-9D969532D960";
const IID_SHELL_ITEM = "43826D1E-E718-42EE-BC55-A1E261C37BFE";
const COINIT_APARTMENTTHREADED = 0x2;
const COINIT_DISABLE_OLE1DDE = 0x4;
const CLSCTX_INPROC_SERVER = 0x1;
const FOS_PICKFOLDERS = 0x20;
const FOS_FORCEFILESYSTEM = 0x40;
const FOS_PATHMUSTEXIST = 0x800;
const SIGDN_FILESYSPATH = 0x80058000;
const WS_POPUP = 0x80000000;
const WS_EX_TOPMOST = 0x8;
const WS_EX_TOOLWINDOW = 0x80;
const DRIVE_REMOTE = 4;
/** `DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2` : une boîte nette à 150 %. */
const DPI_PER_MONITOR_V2 = -4;

function slot(iface: unknown, index: number): unknown {
  const vtable = koffi.decode(iface, "void *");
  return koffi.decode(vtable, index * 8, "void *");
}

function release(iface: unknown): void {
  if (iface) koffi.call(slot(iface, 2), Release, iface);
}

/** `Z:\Films` sur un lecteur mappé → `\\NAS\partage\Films` ; `null` sinon. */
export function mappedDriveUnc(path: string): string | null {
  const drive = /^([A-Za-z]:)(\\.*)?$/.exec(path);
  if (!drive?.[1]) return null;
  if ((GetDriveTypeW(`${drive[1]}\\`) as number) !== DRIVE_REMOTE) return null;
  const buffer = Buffer.alloc(2048);
  const length = [buffer.length / 2];
  if ((WNetGetConnectionW(drive[1], buffer, length) as number) !== 0) return null;
  const remote = buffer.toString("utf16le").split("\0")[0] ?? "";
  if (remote === "") return null;
  const rest = (drive[2] ?? "").replace(/\\+$/, "");
  return `${remote.replace(/\\+$/, "")}${rest}`;
}

/** Une fenêtre minuscule, cachée, au premier plan, vers le milieu de l'écran : la boîte s'y centre. */
function topmostOwner(): unknown {
  const x = Math.floor((GetSystemMetrics(0) as number) / 2);
  const y = Math.floor((GetSystemMetrics(1) as number) / 3);
  const owner = CreateWindowExW(WS_EX_TOPMOST | WS_EX_TOOLWINDOW, "STATIC", "", WS_POPUP, x, y, 1, 1, null, null, null, null);
  if (owner) SetForegroundWindow(owner);
  return owner;
}

export function showFolderDialog(params: PickFolderParams): PickFolderResult {
  SetProcessDpiAwarenessContext(DPI_PER_MONITOR_V2);
  CoInitializeEx(null, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
  const created: unknown[] = [null];
  const hr = CoCreateInstance(guidBuffer(CLSID_FILE_OPEN_DIALOG), null, CLSCTX_INPROC_SERVER, guidBuffer(IID_FILE_OPEN_DIALOG), created) as number;
  if (hr !== 0 || !created[0]) throw new Error(`IFileOpenDialog indisponible (0x${(hr >>> 0).toString(16)})`);
  const dialog = created[0];
  const owner = topmostOwner();
  try {
    const options = [0];
    koffi.call(slot(dialog, 10), GetOptions, dialog, options);
    koffi.call(slot(dialog, 9), SetOptions, dialog, (options[0] ?? 0) | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST);
    if (params.title) koffi.call(slot(dialog, 17), SetTitle, dialog, params.title);
    if (params.initial) {
      const folder: unknown[] = [null];
      if ((SHCreateItemFromParsingName(params.initial, null, guidBuffer(IID_SHELL_ITEM), folder) as number) === 0 && folder[0]) {
        koffi.call(slot(dialog, 12), WithPtr, dialog, folder[0]);
        release(folder[0]);
      }
    }
    // Annulée : HRESULT_FROM_WIN32(ERROR_CANCELLED). Tout échec vaut une annulation.
    if ((koffi.call(slot(dialog, 3), Show, dialog, owner) as number) !== 0) return { path: null };
    const item: unknown[] = [null];
    if ((koffi.call(slot(dialog, 20), GetPtr, dialog, item) as number) !== 0 || !item[0]) return { path: null };
    try {
      const name: unknown[] = [null];
      if ((koffi.call(slot(item[0], 5), GetDisplayName, item[0], SIGDN_FILESYSPATH, name) as number) !== 0 || !name[0]) return { path: null };
      const path = koffi.decode(name[0], "char16_t", -1) as string;
      CoTaskMemFree(name[0]);
      return { path, unc: mappedDriveUnc(path) };
    } finally {
      release(item[0]);
    }
  } finally {
    release(dialog);
    if (owner) DestroyWindow(owner);
  }
}
