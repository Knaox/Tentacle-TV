// Conduite du PiP par CDP : la page principale (drive.mjs du pont) et la page du PiP (le
// navigateur hors écran du popup `tentacle-pip`), plus le diagnostic natif `pip.debug.*`.
// Les gestes de souris vont au navigateur du PiP par CDP : jamais le vrai curseur.
import { Cdp } from "../../web/shim/dev/cdp.mjs";
import { connect, findItem, sleep } from "../../web/shim/dev/drive.mjs";

export { findItem, sleep };
export const PORT = Number(process.env.PONT_CDP_PORT ?? 9426);

async function targets() {
  return (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
}

/** La cible DevTools du PiP (about:blank, ouverte par la page), ou null. */
export async function pipTarget() {
  const all = await targets();
  return all.find((t) => t.type === "page" && t.url === "about:blank") ?? null;
}

export async function drive() {
  const d = await connect();
  const { cdp } = d;
  const extra = {
    /** Le diagnostic natif (hors window.tentacle). */
    state: () => cdp.eval("__shell.invoke('pip.debug.state')"),
    layers: () => cdp.eval("__shell.invoke('shell.debug.layers')"),
    surface: () => cdp.eval("__shell.invoke('pont.debug.surface')"),
    cursor: (p) => cdp.eval(`__shell.invoke('pip.debug.cursor', ${JSON.stringify(p ?? null)})`),
    /** Une propriété de mpv, lue par la porte de la page. */
    prop: (name, format = "double") =>
      cdp.eval(`window.tentacle.invoke("mpv_get_property", { name: ${JSON.stringify(name)}, format: ${JSON.stringify(format)} })`),
    async keyChar(key, code, vk) {
      for (const type of ["keyDown", "keyUp"]) await cdp.send("Input.dispatchKeyEvent", { type, code, key, text: type === "keyDown" ? key : undefined, windowsVirtualKeyCode: vk });
    },
    /** Se connecte à la page du PiP (une fois née). */
    async pip(timeoutMs = 4000) {
      const end = Date.now() + timeoutMs;
      while (Date.now() < end) {
        const t = await pipTarget();
        if (t) return PipPage.open(t);
        await sleep(100);
      }
      return null;
    },
  };
  return Object.assign(d, extra);
}

/** La page du PiP : souris (CDP → son RenderWidgetHost), DOM. */
export class PipPage {
  static async open(target) {
    return new PipPage(await Cdp.connect(target.webSocketDebuggerUrl));
  }
  constructor(cdp) {
    this.cdp = cdp;
  }
  eval(expr) {
    return this.cdp.eval(expr);
  }
  mouse(type, x, y, extra = {}) {
    return this.cdp.send("Input.dispatchMouseEvent", { type, x, y, button: "none", ...extra });
  }
  async move(x, y, buttons = 0) {
    await this.mouse("mouseMoved", x, y, buttons ? { button: "left", buttons } : {});
  }
  async press(x, y, clickCount = 1) {
    await this.mouse("mousePressed", x, y, { button: "left", buttons: 1, clickCount });
  }
  async release(x, y, clickCount = 1) {
    await this.mouse("mouseReleased", x, y, { button: "left", buttons: 0, clickCount });
  }
  wheel(x, y, deltaY) {
    return this.mouse("mouseWheel", x, y, { deltaX: 0, deltaY });
  }
  /** Clique un bouton du PiP par son libellé (aria-label). */
  click(label) {
    return this.eval(`(() => { const b = document.querySelector('button[aria-label=${JSON.stringify(label)}]');
      if (!b) return false; b.click(); return true; })()`);
  }
  close() {
    this.cdp.close();
  }
}
