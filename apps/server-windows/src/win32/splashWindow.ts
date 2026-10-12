/**
 * La fenêtre de l'écran de démarrage : une fenêtre Win32 sans cadre, au
 * premier plan, centrée sur l'écran principal, dessinée par GDI+
 * (`splash/splashPainter.ts`) — ni navigateur, ni moteur web : elle paraît
 * dans les ~100 ms qui suivent le lancement de Node.
 *
 * Même modèle que l'icône (`trayWindow.ts`) : messages relevés par la boucle
 * d'évènements de Node, ici toutes les 33 ms tant qu'elle est ouverte (le
 * reflet de la barre bouge), et gestes renvoyés à la boucle (`setImmediate`),
 * jamais traités DANS la procédure de fenêtre.
 *
 * Souris : un bouton se survole, se presse, se relâche ; ailleurs, la fenêtre
 * se déplace (`HTCAPTION`). Clavier : Tab et les flèches passent d'un bouton
 * à l'autre, Entrée ou Espace valident, Échap ferme. Le titre de la fenêtre
 * reprend l'étape en cours : c'est lui que lit le Narrateur.
 *
 * ⚠️ Ne se charge que sous Windows.
 */
import koffi from "koffi";
import * as gp from "./gdiplus";
import * as w from "./user32";
import {
  BeginPaint,
  CS_DROPSHADOW,
  DWMWA_WINDOW_CORNER_PREFERENCE,
  DWMWCP_ROUND,
  DwmSetWindowAttribute,
  EndPaint,
  GetDpiForSystem,
  GetKeyState,
  HTCAPTION,
  HTCLIENT,
  IDC_ARROW,
  IDC_HAND,
  InvalidateRect,
  LoadCursorW,
  MSG,
  SPI_GETWORKAREA,
  SWP_NOACTIVATE,
  SWP_NOZORDER,
  SW_SHOWNORMAL,
  ScreenToClient,
  SendMessageW,
  SetCursor,
  SetWindowPos,
  SetWindowTextW,
  ShowWindow,
  SystemParametersInfoW,
  TME_LEAVE,
  TrackMouseEvent,
  VK,
  WS_EX_APPWINDOW,
  WS_EX_TOPMOST,
  WS_POPUP,
} from "./splashApi";
import { SplashPainter, type PaintState } from "../splash/splashPainter";
import { hitTest, splashLayout, type SplashLayout } from "../splash/splashLayout";
import type { SplashSurface } from "../splash/splashController";
import type { SplashActionId, SplashView } from "../splash/splashModel";

const CLASS_NAME = "TentacleServerSplash";
const FRAME_MS = 33;

let classRegistered = false;

function signedWord(value: number): number {
  const word = value & 0xffff;
  return word > 0x7fff ? word - 0x10000 : word;
}

export class SplashWindow implements SplashSurface {
  private readonly hwnd: unknown;
  private readonly callback: ReturnType<typeof koffi.register>;
  private readonly painter: SplashPainter | null;
  private readonly opened = Date.now();
  private readonly hand = LoadCursorW(null, IDC_HAND);
  private readonly arrow = LoadCursorW(null, IDC_ARROW);
  private view: SplashView;
  private layout: SplashLayout;
  private scale: number;
  private frame: NodeJS.Timeout | null = null;
  private tracking = false;
  private paint: PaintState = { progress: 0, time: 0, hover: null, focus: null, pressed: null };
  private disposed = false;

  constructor(logo: string | null, icon: string | null, initial: SplashView, private readonly onAction: (id: SplashActionId) => void) {
    w.SetProcessDpiAwarenessContext(w.DPI_PER_MONITOR_V2);
    this.painter = gp.ensureGdiplus() ? new SplashPainter(logo) : null;
    this.view = initial;
    this.layout = splashLayout(initial);
    this.paint.progress = initial.progress ?? 0;
    this.scale = (GetDpiForSystem() as number) / 96 || 1;
    const instance = w.GetModuleHandleW(null);
    this.callback = koffi.register(
      (hwnd: unknown, msg: number, wParam: number | bigint, lParam: number | bigint) => this.windowProc(hwnd, msg, wParam, lParam),
      koffi.pointer(w.WndProc),
    );
    if (!classRegistered) {
      classRegistered = true;
      w.RegisterClassExW({
        cbSize: koffi.sizeof("WNDCLASSEXW"),
        style: CS_DROPSHADOW,
        lpfnWndProc: this.callback,
        cbClsExtra: 0,
        cbWndExtra: 0,
        hInstance: instance,
        hIcon: null,
        hCursor: null,
        hbrBackground: null,
        lpszMenuName: null,
        lpszClassName: CLASS_NAME,
        hIconSm: null,
      });
    }
    const [x, y, width, height] = this.placement();
    this.hwnd = w.CreateWindowExW(WS_EX_TOPMOST | WS_EX_APPWINDOW, CLASS_NAME, `Tentacle Server — ${initial.status}`, WS_POPUP, x, y, width, height, null, null, instance, null);
    DwmSetWindowAttribute(this.hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, [DWMWCP_ROUND], 4);
    this.setIcon(icon);
    ShowWindow(this.hwnd, SW_SHOWNORMAL);
    w.SetForegroundWindow(this.hwnd);
    this.frame = setInterval(() => this.tick(), FRAME_MS);
  }

  render(view: SplashView): void {
    if (this.disposed) return;
    const heightBefore = this.layout.height;
    this.view = view;
    this.layout = splashLayout(view);
    const ids = view.buttons.map((b) => b.id);
    if (this.paint.focus === null || !ids.includes(this.paint.focus)) this.paint.focus = ids[0] ?? null;
    if (this.layout.height !== heightBefore) {
      const [x, y, width, height] = this.placement();
      SetWindowPos(this.hwnd, null, x, y, width, height, SWP_NOZORDER | SWP_NOACTIVATE);
    }
    SetWindowTextW(this.hwnd, `Tentacle Server — ${view.status}`);
    InvalidateRect(this.hwnd, null, 0);
  }

  close(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frame !== null) clearInterval(this.frame);
    this.frame = null;
    w.DestroyWindow(this.hwnd);
    this.painter?.dispose();
  }

  /** Centrée dans la zone de travail de l'écran principal, à la taille de sa mise en page. */
  private placement(): [number, number, number, number] {
    const width = Math.round(this.layout.width * this.scale);
    const height = Math.round(this.layout.height * this.scale);
    const area = { left: 0, top: 0, right: 0, bottom: 0 };
    SystemParametersInfoW(SPI_GETWORKAREA, 0, area, 0);
    const x = area.left + Math.round((area.right - area.left - width) / 2);
    const y = area.top + Math.round((area.bottom - area.top - height) / 2);
    return [x, y, width, height];
  }

  private setIcon(path: string | null): void {
    if (path === null) return;
    for (const [kind, size] of [[0, 16], [1, 32]] as const) {
      const icon = w.LoadImageW(null, path, w.IMAGE_ICON, Math.round(size * this.scale), Math.round(size * this.scale), w.LR_LOADFROMFILE);
      if (icon) SendMessageW(this.hwnd, MSG.SETICON, kind, koffi.address(icon));
    }
  }

  private tick(): void {
    const target = this.view.progress ?? this.paint.progress;
    this.paint.progress += (target - this.paint.progress) * 0.18;
    this.paint.time = Date.now() - this.opened;
    InvalidateRect(this.hwnd, null, 0);
    const msg = {};
    while (w.PeekMessageW(msg, null, 0, 0, w.PM_REMOVE)) {
      w.TranslateMessage(msg);
      w.DispatchMessageW(msg);
    }
  }

  /** Le point client (pixels physiques) en unités logiques de la mise en page. */
  private logical(lParam: number | bigint): [number, number] {
    const value = Number(lParam);
    return [signedWord(value) / this.scale, signedWord(value >>> 16) / this.scale];
  }

  private hitAtScreen(lParam: number | bigint): SplashActionId | null {
    const value = Number(lParam);
    const point = { x: signedWord(value), y: signedWord(value >>> 16) };
    ScreenToClient(this.hwnd, point);
    return hitTest(this.layout, point.x / this.scale, point.y / this.scale);
  }

  private act(id: SplashActionId): void {
    setImmediate(() => this.onAction(id));
  }

  private moveFocus(step: number): void {
    const ids = this.view.buttons.map((b) => b.id);
    if (ids.length === 0) return;
    const index = this.paint.focus === null ? -1 : ids.indexOf(this.paint.focus);
    this.paint.focus = ids[(index + step + ids.length) % ids.length] ?? null;
  }

  private draw(hwnd: unknown): void {
    const ps = {};
    const hdc = BeginPaint(hwnd, ps);
    try {
      const painter = this.painter;
      if (!painter || !hdc) return;
      const width = Math.round(this.layout.width * this.scale);
      const height = Math.round(this.layout.height * this.scale);
      gp.drawBuffered(hdc, width, height, this.scale, (canvas) => painter.paint(canvas, this.layout, this.view, this.paint));
    } finally {
      EndPaint(hwnd, ps);
    }
  }

  private windowProc(hwnd: unknown, msg: number, wParam: number | bigint, lParam: number | bigint): number | bigint {
    switch (msg) {
      case MSG.PAINT:
        this.draw(hwnd);
        return 0;
      case MSG.ERASEBKGND:
        return 1;
      case MSG.NCHITTEST:
        // Hors des boutons, la fenêtre se déplace comme par sa barre de titre.
        return this.hitAtScreen(lParam) === null ? HTCAPTION : HTCLIENT;
      case MSG.SETCURSOR:
        if (this.paint.hover !== null) {
          SetCursor(this.hand);
          return 1;
        }
        SetCursor(this.arrow);
        return 1;
      case MSG.MOUSEMOVE: {
        const [x, y] = this.logical(lParam);
        this.paint.hover = hitTest(this.layout, x, y);
        if (!this.tracking) {
          this.tracking = Boolean(TrackMouseEvent({ cbSize: koffi.sizeof("SPLASH_TRACKMOUSEEVENT"), dwFlags: TME_LEAVE, hwndTrack: hwnd, dwHoverTime: 0 }));
        }
        return 0;
      }
      case MSG.MOUSELEAVE:
        this.tracking = false;
        this.paint.hover = null;
        this.paint.pressed = null;
        return 0;
      case MSG.LBUTTONDOWN: {
        const [x, y] = this.logical(lParam);
        this.paint.pressed = hitTest(this.layout, x, y);
        return 0;
      }
      case MSG.LBUTTONUP: {
        const [x, y] = this.logical(lParam);
        const hit = hitTest(this.layout, x, y);
        if (hit !== null && hit === this.paint.pressed) this.act(hit);
        this.paint.pressed = null;
        return 0;
      }
      case MSG.KEYDOWN:
        return this.onKey(Number(wParam));
      case MSG.CLOSE:
        // Alt+F4 : comme la croix.
        this.act("close");
        return 0;
      case MSG.DPICHANGED:
        this.scale = (Number(wParam) & 0xffff) / 96 || this.scale;
        this.render(this.view);
        {
          const [x, y, width, height] = this.placement();
          SetWindowPos(this.hwnd, null, x, y, width, height, SWP_NOZORDER | SWP_NOACTIVATE);
        }
        return 0;
      default:
        return w.DefWindowProcW(hwnd, msg, wParam, lParam) as number | bigint;
    }
  }

  private onKey(key: number): number {
    if (key === VK.ESCAPE) this.act("close");
    else if (key === VK.TAB) this.moveFocus((GetKeyState(VK.SHIFT) as number) < 0 ? -1 : 1);
    else if (key === VK.LEFT || key === VK.UP) this.moveFocus(-1);
    else if (key === VK.RIGHT || key === VK.DOWN) this.moveFocus(1);
    else if ((key === VK.RETURN || key === VK.SPACE) && this.paint.focus !== null) this.act(this.paint.focus);
    return 0;
  }
}
