/**
 * Les signatures `user32.dll` et `shell32.dll` de l'icône et de son menu.
 * Un seul endroit pour les types et les constantes ; `trayWindow.ts` et
 * `popupMenu.ts` ne font que s'en servir.
 *
 * Les descripteurs (fenêtre, icône, menu) passent en `void *` : opaques de
 * bout en bout, jamais comparés ni calculés.
 *
 * ⚠️ Ne se charge que sous Windows : `koffi.load` s'exécute à l'import.
 */
import koffi from "koffi";

const user32 = koffi.load("user32.dll");
const shell32 = koffi.load("shell32.dll");
const kernel32 = koffi.load("kernel32.dll");

export const WndProc = koffi.proto(
  "intptr_t __stdcall TentacleWndProc(void *hwnd, uint32 msg, uintptr_t wParam, intptr_t lParam)",
);

koffi.struct("WNDCLASSEXW", {
  cbSize: "uint32",
  style: "uint32",
  lpfnWndProc: koffi.pointer(WndProc),
  cbClsExtra: "int",
  cbWndExtra: "int",
  hInstance: "void *",
  hIcon: "void *",
  hCursor: "void *",
  hbrBackground: "void *",
  lpszMenuName: "const char16_t *",
  lpszClassName: "const char16_t *",
  hIconSm: "void *",
});
koffi.struct("TRAY_POINT", { x: "long", y: "long" });
koffi.struct("TRAY_MSG", {
  hwnd: "void *",
  message: "uint32",
  wParam: "uintptr_t",
  lParam: "intptr_t",
  time: "uint32",
  pt: "TRAY_POINT",
  lPrivate: "uint32",
});
koffi.struct("TRAY_GUID", { Data1: "uint32", Data2: "uint16", Data3: "uint16", Data4: "uint8[8]" });
export const NOTIFYICONDATAW = koffi.struct("NOTIFYICONDATAW", {
  cbSize: "uint32",
  hWnd: "void *",
  uID: "uint32",
  uFlags: "uint32",
  uCallbackMessage: "uint32",
  hIcon: "void *",
  szTip: "char16_t[128]",
  dwState: "uint32",
  dwStateMask: "uint32",
  szInfo: "char16_t[256]",
  // Union `uTimeout` / `uVersion` : un seul champ de 32 bits.
  uVersion: "uint32",
  szInfoTitle: "char16_t[64]",
  dwInfoFlags: "uint32",
  guidItem: "TRAY_GUID",
  hBalloonIcon: "void *",
});

export const GetModuleHandleW = kernel32.func("void *GetModuleHandleW(const char16_t *name)");
export const RegisterClassExW = user32.func("uint16 RegisterClassExW(const WNDCLASSEXW *cls)");
export const CreateWindowExW = user32.func(
  "void *CreateWindowExW(uint32 exStyle, const char16_t *cls, const char16_t *title, uint32 style, int x, int y, int w, int h, void *parent, void *menu, void *instance, void *param)",
);
export const DestroyWindow = user32.func("int DestroyWindow(void *hwnd)");
export const DefWindowProcW = user32.func("intptr_t DefWindowProcW(void *hwnd, uint32 msg, uintptr_t wParam, intptr_t lParam)");
export const PeekMessageW = user32.func("int PeekMessageW(_Out_ TRAY_MSG *msg, void *hwnd, uint32 min, uint32 max, uint32 remove)");
export const TranslateMessage = user32.func("int TranslateMessage(const TRAY_MSG *msg)");
export const DispatchMessageW = user32.func("intptr_t DispatchMessageW(const TRAY_MSG *msg)");
export const RegisterWindowMessageW = user32.func("uint32 RegisterWindowMessageW(const char16_t *name)");
export const PostMessageW = user32.func("int PostMessageW(void *hwnd, uint32 msg, uintptr_t wParam, intptr_t lParam)");
export const SetForegroundWindow = user32.func("int SetForegroundWindow(void *hwnd)");
export const GetCursorPos = user32.func("int GetCursorPos(_Out_ TRAY_POINT *point)");
export const GetSystemMetrics = user32.func("int GetSystemMetrics(int index)");
export const LoadImageW = user32.func(
  "void *LoadImageW(void *instance, const char16_t *name, uint32 type, int cx, int cy, uint32 flags)",
);
export const LoadIconW = user32.func("void *LoadIconW(void *instance, uintptr_t id)");
export const DestroyIcon = user32.func("int DestroyIcon(void *icon)");
export const SetProcessDpiAwarenessContext = user32.func("int SetProcessDpiAwarenessContext(intptr_t context)");
export const ShutdownBlockReasonCreate = user32.func("int ShutdownBlockReasonCreate(void *hwnd, const char16_t *reason)");
export const ShutdownBlockReasonDestroy = user32.func("int ShutdownBlockReasonDestroy(void *hwnd)");

export const CreatePopupMenu = user32.func("void *CreatePopupMenu()");
export const AppendMenuW = user32.func("int AppendMenuW(void *menu, uint32 flags, uintptr_t id, const char16_t *text)");
export const SetMenuDefaultItem = user32.func("int SetMenuDefaultItem(void *menu, uint32 item, uint32 byPosition)");
export const TrackPopupMenuEx = user32.func("int TrackPopupMenuEx(void *menu, uint32 flags, int x, int y, void *hwnd, void *params)");
export const DestroyMenu = user32.func("int DestroyMenu(void *menu)");

export const Shell_NotifyIconW = shell32.func("int Shell_NotifyIconW(uint32 message, NOTIFYICONDATAW *data)");

export const WM = {
  NULL: 0x0000,
  QUERYENDSESSION: 0x0011,
  ENDSESSION: 0x0016,
  CONTEXTMENU: 0x007b,
  LBUTTONDBLCLK: 0x0203,
  APP_TRAY: 0x8001,
} as const;

export const NIN = { SELECT: 0x0400, KEYSELECT: 0x0401, BALLOONUSERCLICK: 0x0405 } as const;
export const NIM = { ADD: 0, MODIFY: 1, DELETE: 2, SETVERSION: 4 } as const;
export const NIF = { MESSAGE: 0x01, ICON: 0x02, TIP: 0x04, INFO: 0x10, SHOWTIP: 0x80 } as const;
export const NIIF = { INFO: 0x1, WARNING: 0x2, ERROR: 0x3 } as const;
export const NOTIFYICON_VERSION_4 = 4;

export const MF = { STRING: 0x0, GRAYED: 0x1, CHECKED: 0x8, POPUP: 0x10, SEPARATOR: 0x800 } as const;
export const TPM = { RIGHTBUTTON: 0x2, NONOTIFY: 0x80, RETURNCMD: 0x100 } as const;

export const IMAGE_ICON = 1;
export const LR_LOADFROMFILE = 0x10;
export const SM_CXSMICON = 49;
export const SM_CYSMICON = 50;
export const IDI_APPLICATION = 32512;
export const PM_REMOVE = 0x1;
/** `DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2` : une icône et des boîtes nettes à 150 %. */
export const DPI_PER_MONITOR_V2 = -4;
