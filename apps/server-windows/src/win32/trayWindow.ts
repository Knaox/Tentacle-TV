/**
 * L'icône de la zone de notification : une fenêtre cachée, son icône
 * (`Shell_NotifyIconW`, version 4), et la pompe de messages.
 *
 * La pompe est relevée toutes les 100 ms par la boucle d'évènements de Node
 * (`PeekMessageW`) : mesuré par l'étude techno, +4,5 Mo et un réveil par
 * tick. Les clics sont renvoyés à la boucle (`setImmediate`) pour que le menu
 * (une boucle modale) ne tourne jamais DANS la procédure de fenêtre.
 *
 * Fenêtre de premier niveau (cachée), pas `HWND_MESSAGE` : seule une vraie
 * fenêtre reçoit « TaskbarCreated », envoyé quand l'Explorateur redémarre —
 * sans lui, l'icône disparaîtrait pour de bon.
 *
 * ⚠️ Ne se charge que sous Windows.
 */
import koffi from "koffi";
import * as w from "./user32";

export type BalloonLevel = "info" | "warning" | "error";

export interface TrayHandlers {
  /** Clic (gauche ou droit) ou clavier : ouvrir le menu à ce point. */
  onMenu(x: number, y: number): void;
  onBalloonClick(): void;
  /** Windows demande s'il peut fermer la session : commencer l'arrêt du serveur. */
  onQueryEndSession(): void;
  /** La session se ferme pour de bon : finir l'arrêt, de façon SYNCHRONE. */
  onEndSession(): void;
  /** La fermeture de session a été annulée. */
  onEndSessionCancelled(): void;
}

const CLASS_NAME = "TentacleServerTray";
const ICON_ID = 1;
const PUMP_MS = 100;

function lowWord(value: number): number {
  return value & 0xffff;
}

/** Coordonnée signée sur 16 bits (écrans à gauche ou au-dessus du principal). */
function signedWord(value: number): number {
  const word = value & 0xffff;
  return word > 0x7fff ? word - 0x10000 : word;
}

export class TrayWindow {
  private readonly hwnd: unknown;
  private readonly icon: unknown;
  private readonly callback: ReturnType<typeof koffi.register>;
  private readonly taskbarCreated: number;
  private pump: NodeJS.Timeout | null = null;
  private tip = "";
  private added = false;

  constructor(iconPath: string | null, private readonly handlers: TrayHandlers, private readonly blockReason: string) {
    w.SetProcessDpiAwarenessContext(w.DPI_PER_MONITOR_V2);
    const instance = w.GetModuleHandleW(null);
    this.callback = koffi.register(
      (hwnd: unknown, msg: number, wParam: number | bigint, lParam: number | bigint) =>
        this.windowProc(hwnd, msg, wParam, lParam),
      koffi.pointer(w.WndProc),
    );
    w.RegisterClassExW({
      cbSize: koffi.sizeof("WNDCLASSEXW"),
      style: 0,
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
    this.hwnd = w.CreateWindowExW(0, CLASS_NAME, "Tentacle Server", 0, 0, 0, 0, 0, null, null, instance, null);
    this.taskbarCreated = w.RegisterWindowMessageW("TaskbarCreated") as number;
    this.icon = this.loadIcon(iconPath);
  }

  /** Pose l'icône et lance la pompe de messages. */
  show(tip: string): void {
    this.tip = tip;
    this.add();
    this.pump ??= setInterval(() => this.drain(), PUMP_MS);
  }

  setTooltip(tip: string): void {
    if (tip === this.tip) return;
    this.tip = tip;
    w.Shell_NotifyIconW(w.NIM.MODIFY, this.data(w.NIF.TIP | w.NIF.SHOWTIP));
  }

  /** Une notification de Windows, rattachée à l'icône. */
  notify(title: string, text: string, level: BalloonLevel): void {
    const flags = level === "error" ? w.NIIF.ERROR : level === "warning" ? w.NIIF.WARNING : w.NIIF.INFO;
    w.Shell_NotifyIconW(w.NIM.MODIFY, {
      ...this.data(w.NIF.INFO),
      szInfoTitle: title.slice(0, 63),
      szInfo: text.slice(0, 255),
      dwInfoFlags: flags,
    });
  }

  /** La fenêtre propriétaire du menu. */
  get handle(): unknown {
    return this.hwnd;
  }

  dispose(): void {
    if (this.pump !== null) clearInterval(this.pump);
    this.pump = null;
    if (this.added) w.Shell_NotifyIconW(w.NIM.DELETE, this.data(0));
    this.added = false;
    w.DestroyWindow(this.hwnd);
  }

  private loadIcon(path: string | null): unknown {
    if (path !== null) {
      const cx = w.GetSystemMetrics(w.SM_CXSMICON) as number;
      const cy = w.GetSystemMetrics(w.SM_CYSMICON) as number;
      const icon = w.LoadImageW(null, path, w.IMAGE_ICON, cx, cy, w.LR_LOADFROMFILE);
      if (icon) return icon;
    }
    return w.LoadIconW(null, w.IDI_APPLICATION);
  }

  private data(flags: number): Record<string, unknown> {
    return {
      cbSize: koffi.sizeof(w.NOTIFYICONDATAW),
      hWnd: this.hwnd,
      uID: ICON_ID,
      uFlags: flags,
      uCallbackMessage: w.WM.APP_TRAY,
      hIcon: this.icon,
      szTip: this.tip,
      uVersion: w.NOTIFYICON_VERSION_4,
    };
  }

  private add(): void {
    this.added = Boolean(w.Shell_NotifyIconW(w.NIM.ADD, this.data(w.NIF.MESSAGE | w.NIF.ICON | w.NIF.TIP | w.NIF.SHOWTIP)));
    if (this.added) w.Shell_NotifyIconW(w.NIM.SETVERSION, this.data(0));
  }

  private drain(): void {
    const msg = {};
    while (w.PeekMessageW(msg, null, 0, 0, w.PM_REMOVE)) {
      w.TranslateMessage(msg);
      w.DispatchMessageW(msg);
    }
  }

  private windowProc(hwnd: unknown, msg: number, wParam: number | bigint, lParam: number | bigint): number | bigint {
    if (msg === w.WM.APP_TRAY) {
      const event = lowWord(Number(lParam));
      if (event === w.WM.CONTEXTMENU || event === w.NIN.SELECT || event === w.NIN.KEYSELECT) {
        const anchor = Number(wParam);
        setImmediate(() => this.handlers.onMenu(signedWord(anchor), signedWord(anchor >>> 16)));
      } else if (event === w.NIN.BALLOONUSERCLICK) {
        setImmediate(() => this.handlers.onBalloonClick());
      }
      return 0;
    }
    if (msg === this.taskbarCreated) {
      this.add();
      return 0;
    }
    if (msg === w.WM.QUERYENDSESSION) {
      w.ShutdownBlockReasonCreate(this.hwnd, this.blockReason);
      this.handlers.onQueryEndSession();
      return 1;
    }
    if (msg === w.WM.ENDSESSION) {
      if (Number(wParam) !== 0) this.handlers.onEndSession();
      else this.handlers.onEndSessionCancelled();
      w.ShutdownBlockReasonDestroy(this.hwnd);
      return 0;
    }
    return w.DefWindowProcW(hwnd, msg, wParam, lParam) as number | bigint;
  }
}
