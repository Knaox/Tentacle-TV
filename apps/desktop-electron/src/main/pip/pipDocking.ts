/**
 * Le PiP ancré, tenu devant l'application SANS en être une fenêtre fille.
 *
 * # Pourquoi pas `setParentWindow`
 *
 * Fille de la fenêtre principale, la fenêtre PiP suivait l'application et
 * restait devant elle d'elle-même — mais elle ne recevait plus la souris :
 * UN `mousemove` à l'entrée, puis un `mouseout` aussitôt, que l'application
 * soit active ou non (banc du 10.10.2026, souris réelle simulée par
 * CoreGraphics). La page n'affichait donc jamais ses contrôles au survol, ni
 * la molette. La même fenêtre, flottante et sans parent, les recevait toutes.
 *
 * # Ce qui la remplace
 *
 * - application ACTIVE (la fenêtre principale ou le PiP a le focus) : niveau
 *   « floating » — devant la fenêtre principale, quoi qu'on y clique. Rien
 *   d'une autre application n'est alors devant la nôtre ;
 * - application INACTIVE : niveau normal, posé juste au-dessus de la fenêtre
 *   principale — une autre application qui la couvre couvre aussi le PiP ;
 * - fenêtre principale réduite ou masquée : le PiP aussi ; il revient avec
 *   elle. La position, elle, suit déjà ses déplacements (`pipShell.ts`).
 *
 * # Le curseur relayé, application inactive
 *
 * Au niveau normal, application inactive, macOS ne livre plus au PiP qu'UN
 * mouvement à l'entrée (mesuré ; la molette, elle, arrive) — au niveau
 * « floating », tous. Le temps que l'application reste inactive, le processus
 * principal relaie donc le curseur à la page (`sendInputEvent`) quand il
 * survole le PiP : les contrôles paraissent sans clic. Rien d'autre ne tourne.
 */

import { app, BrowserWindow, screen } from "electron";
import { notifyPipRestacked } from "./pipHost";

/** Le curseur relayé, application inactive : 30 fois par seconde suffisent au survol. */
const RELAY_MS = 33;

export class PipDocking {
  private active = false;
  private relay: ReturnType<typeof setInterval> | null = null;
  /** Le dernier point relayé, dans le PiP — `null` : le curseur est dehors. */
  private relayed: { x: number; y: number } | null = null;

  private readonly sync = (): void => {
    // Le focus passe d'une fenêtre à l'autre en deux temps (`blur`, puis
    // `focus`) : on lit l'état une fois le passage fini.
    setImmediate(() => this.apply());
  };
  private readonly hide = (): void => {
    if (!this.pip.isDestroyed()) this.pip.hide();
  };
  private readonly reveal = (): void => {
    if (this.pip.isDestroyed() || this.host.isDestroyed() || this.host.isMinimized()) return;
    this.pip.showInactive();
    this.apply();
  };

  constructor(
    private readonly pip: BrowserWindow,
    private readonly host: BrowserWindow,
  ) {}

  start(): void {
    for (const window of [this.host, this.pip]) {
      window.on("focus", this.sync);
      window.on("blur", this.sync);
    }
    // Une autre application au premier plan : aucune de nos fenêtres ne reçoit
    // `blur` (mesuré) — l'application, elle, le sait.
    app.on("did-become-active", this.sync);
    app.on("did-resign-active", this.sync);
    this.host.on("minimize", this.hide);
    this.host.on("hide", this.hide);
    this.host.on("restore", this.reveal);
    this.host.on("show", this.reveal);
    this.apply(true);
  }

  stop(): void {
    this.stopRelay();
    app.off("did-become-active", this.sync);
    app.off("did-resign-active", this.sync);
    for (const window of [this.host, this.pip]) {
      if (window.isDestroyed()) continue;
      window.off("focus", this.sync);
      window.off("blur", this.sync);
    }
    if (this.host.isDestroyed()) return;
    this.host.off("minimize", this.hide);
    this.host.off("hide", this.hide);
    this.host.off("restore", this.reveal);
    this.host.off("show", this.reveal);
  }

  private apply(force = false): void {
    if (this.pip.isDestroyed() || this.host.isDestroyed()) return;
    const focused = BrowserWindow.getFocusedWindow();
    const active = focused === this.host || focused === this.pip;
    if (!force && active === this.active) return;
    this.active = active;
    if (active) {
      this.stopRelay();
      this.pip.setAlwaysOnTop(true, "floating");
    } else {
      this.pip.setAlwaysOnTop(false);
      this.pip.moveAbove(this.host.getMediaSourceId());
      this.relay ??= setInterval(() => this.relayCursor(), RELAY_MS);
    }
    // La fenêtre de mpv, fille du PiP, en reprend le niveau sur-le-champ.
    notifyPipRestacked();
  }

  /** Le curseur au-dessus du PiP : un mouvement ; sorti : une sortie. */
  private relayCursor(): void {
    if (this.pip.isDestroyed() || !this.pip.isVisible()) return;
    const cursor = screen.getCursorScreenPoint();
    const bounds = this.pip.getBounds();
    const x = cursor.x - bounds.x;
    const y = cursor.y - bounds.y;
    const inside = x >= 0 && y >= 0 && x < bounds.width && y < bounds.height;
    if (!inside) {
      if (this.relayed !== null) this.pip.webContents.sendInputEvent({ type: "mouseLeave", x: this.relayed.x, y: this.relayed.y });
      this.relayed = null;
      return;
    }
    if (this.relayed?.x === x && this.relayed.y === y) return;
    this.relayed = { x, y };
    this.pip.webContents.sendInputEvent({ type: "mouseMove", x, y });
  }

  private stopRelay(): void {
    if (this.relay !== null) clearInterval(this.relay);
    this.relay = null;
    this.relayed = null;
  }
}
