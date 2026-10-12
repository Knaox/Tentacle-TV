/**
 * Les signatures `user32.dll` et `dwmapi.dll` propres à l'écran de démarrage
 * (`splashWindow.ts`) : dessin, placement, curseur, souris, coins arrondis de
 * Windows 11. Celles qu'il partage avec l'icône restent dans `user32.ts`.
 *
 * ⚠️ Ne se charge que sous Windows : `koffi.load` s'exécute à l'import.
 */
import koffi from "koffi";

const user32 = koffi.load("user32.dll");
const dwmapi = koffi.load("dwmapi.dll");

koffi.struct("SPLASH_RECT", { left: "long", top: "long", right: "long", bottom: "long" });
koffi.struct("SPLASH_POINT", { x: "long", y: "long" });
koffi.struct("SPLASH_PAINTSTRUCT", {
  hdc: "void *",
  fErase: "int",
  rcPaint: "SPLASH_RECT",
  fRestore: "int",
  fIncUpdate: "int",
  rgbReserved: "uint8[32]",
});
koffi.struct("SPLASH_TRACKMOUSEEVENT", { cbSize: "uint32", dwFlags: "uint32", hwndTrack: "void *", dwHoverTime: "uint32" });

export const BeginPaint = user32.func("void *BeginPaint(void *hwnd, _Out_ SPLASH_PAINTSTRUCT *paint)");
export const EndPaint = user32.func("int EndPaint(void *hwnd, const SPLASH_PAINTSTRUCT *paint)");
export const InvalidateRect = user32.func("int InvalidateRect(void *hwnd, void *rect, int erase)");
export const ShowWindow = user32.func("int ShowWindow(void *hwnd, int command)");
export const SetWindowPos = user32.func("int SetWindowPos(void *hwnd, void *after, int x, int y, int cx, int cy, uint32 flags)");
export const SetWindowTextW = user32.func("int SetWindowTextW(void *hwnd, const char16_t *text)");
export const ScreenToClient = user32.func("int ScreenToClient(void *hwnd, _Inout_ SPLASH_POINT *point)");
export const SystemParametersInfoW = user32.func("int SystemParametersInfoW(uint32 action, uint32 param, _Out_ SPLASH_RECT *rect, uint32 winIni)");
export const GetDpiForSystem = user32.func("uint32 GetDpiForSystem()");
export const LoadCursorW = user32.func("void *LoadCursorW(void *instance, uintptr_t id)");
export const SetCursor = user32.func("void *SetCursor(void *cursor)");
export const TrackMouseEvent = user32.func("int TrackMouseEvent(SPLASH_TRACKMOUSEEVENT *event)");
export const SendMessageW = user32.func("intptr_t SendMessageW(void *hwnd, uint32 msg, uintptr_t wParam, intptr_t lParam)");
export const DwmSetWindowAttribute = dwmapi.func("long DwmSetWindowAttribute(void *hwnd, uint32 attribute, _In_ int *value, uint32 size)");

export const MSG = {
  CLOSE: 0x0010,
  PAINT: 0x000f,
  ERASEBKGND: 0x0014,
  SETCURSOR: 0x0020,
  NCHITTEST: 0x0084,
  KEYDOWN: 0x0100,
  MOUSEMOVE: 0x0200,
  LBUTTONDOWN: 0x0201,
  LBUTTONUP: 0x0202,
  MOUSELEAVE: 0x02a3,
  DPICHANGED: 0x02e0,
  SETICON: 0x0080,
} as const;
export const VK = { TAB: 0x09, RETURN: 0x0d, ESCAPE: 0x1b, SPACE: 0x20, LEFT: 0x25, UP: 0x26, RIGHT: 0x27, DOWN: 0x28, SHIFT: 0x10 } as const;
export const WS_POPUP = 0x80000000;
export const WS_EX_TOPMOST = 0x8;
export const WS_EX_APPWINDOW = 0x40000;
export const CS_DROPSHADOW = 0x20000;
export const HTCLIENT = 1;
export const HTCAPTION = 2;
export const SW_SHOWNORMAL = 1;
export const SWP_NOZORDER = 0x4;
export const SWP_NOACTIVATE = 0x10;
export const SPI_GETWORKAREA = 0x30;
export const IDC_ARROW = 32512;
export const IDC_HAND = 32649;
export const TME_LEAVE = 0x2;
export const DWMWA_WINDOW_CORNER_PREFERENCE = 33;
export const DWMWCP_ROUND = 2;
export const GetKeyState = user32.func("int16 GetKeyState(int key)");

