/**
 * Le banc de la souris de l'aperçu (`usePreviewPointer.test.ts`) : un DOCUMENT
 * factice, juste ce que le crochet en lit — l'élément sous la souris (la
 * géométrie), l'état `:hover` (qui peut retarder), les évènements de pointeur
 * et de focus, l'observateur de mutations et l'image d'animation. Ce module
 * n'est pas un test.
 */

type Listener = (event: unknown) => void;

/** Un élément : sa balise, son rôle, ses attributs, son parent — et un `closest` qui lit les sélecteurs de la règle. */
export class FakeElement {
  parent: FakeElement | null = null;
  tabIndex = -1;
  readonly listeners = new Map<string, Set<Listener>>();
  constructor(readonly tag: string, readonly attrs: Record<string, string> = {}, readonly env: PointerEnv | null = null) {}

  append(child: FakeElement): FakeElement {
    child.parent = this;
    return child;
  }
  contains(other: unknown): boolean {
    for (let node = other as FakeElement | null; node; node = node.parent) if (node === this) return true;
    return false;
  }
  /** `button`, `a[href]`, `[role="toolbar"]`, `[data-preview-hold]`… séparés par des virgules. */
  matches(selector: string): boolean {
    return selector.split(",").map((part) => part.trim()).some((part) => {
      const match = /^([a-z]*)(?:\[([\w-]+)(?:="([^"]*)")?\])?$/.exec(part);
      if (!match) return false;
      const [, tag, attr, value] = match;
      if (tag && tag !== this.tag) return false;
      if (attr === undefined) return tag !== "";
      return attr in this.attrs && (value === undefined || this.attrs[attr] === value);
    });
  }
  closest(selector: string): FakeElement | null {
    return this.matches(selector) ? this : this.parent?.closest(selector) ?? null;
  }
  /** Seul `:hover` est demandé : la chaîne des éléments que le NAVIGATEUR croit survolés, dans cet élément. */
  querySelectorAll(selector: string): FakeElement[] {
    if (selector !== ":hover" || !this.env) return [];
    const chain: FakeElement[] = [];
    for (let node = this.env.hoverState; node && node !== this; node = node.parent) chain.unshift(node);
    return this.env.hoverState && this.contains(this.env.hoverState) ? chain : [];
  }
  addEventListener(type: string, listener: Listener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)?.add(listener);
  }
  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }
}

export interface PointerEnv {
  /** Ce qu'il y a VRAIMENT sous la souris (`document.elementFromPoint`). */
  under: FakeElement | null;
  /** Ce que le navigateur croit survolé (`:hover`) — en retard après un remplacement sous une souris immobile. */
  hoverState: FakeElement | null;
  /** La souris passe sur `target` : `pointerover` (ancre et document), `:hover` et géométrie à jour. */
  moveTo(target: FakeElement): void;
  /** Un élément naît ou est remplacé sous la souris IMMOBILE : la géométrie change, aucun évènement de pointeur. */
  replaceUnder(next: FakeElement): void;
  focus(target: FakeElement | null): void;
  /** L'image d'animation suivante. */
  frame(): void;
  restore(): void;
}

/** Pose le document factice sur les globaux ; `restore` les rend. À appeler AVANT d'importer le crochet. */
export function installPointerEnv(): PointerEnv {
  const g = globalThis as Record<string, unknown>;
  const saved = { Element: g.Element, document: g.document, window: g.window, MutationObserver: g.MutationObserver, raf: g.requestAnimationFrame, caf: g.cancelAnimationFrame };
  const documentListeners = new Map<string, Set<Listener>>();
  const windowListeners = new Map<string, Set<Listener>>();
  const observers = new Set<() => void>();
  let frames: Array<() => void> = [];
  const fire = (listeners: Map<string, Set<Listener>>, type: string, event: unknown) => [...(listeners.get(type) ?? [])].forEach((listener) => listener(event));
  const env: PointerEnv = {
    under: null,
    hoverState: null,
    moveTo(target) {
      env.under = target;
      env.hoverState = target;
      // Une position connue : `useHoverGuard` l'apprend du `pointermove` de la fenêtre.
      fire(windowListeners, "pointermove", { clientX: 10, clientY: 10 });
      for (let node: FakeElement | null = target; node; node = node.parent) fire(node.listeners, "pointerover", { target, relatedTarget: null });
      fire(documentListeners, "pointerover", { target, relatedTarget: null });
    },
    replaceUnder(next) {
      env.under = next;
      for (const notify of [...observers]) notify();
    },
    focus(target) {
      fakeDocument.activeElement = target;
      fire(documentListeners, target ? "focusin" : "focusout", { target });
    },
    frame() {
      const due = frames;
      frames = [];
      due.forEach((callback) => callback());
    },
    restore() {
      Object.assign(g, { Element: saved.Element, document: saved.document, window: saved.window, MutationObserver: saved.MutationObserver, requestAnimationFrame: saved.raf, cancelAnimationFrame: saved.caf });
    },
  };
  const fakeDocument = {
    nodeType: 9,
    activeElement: null as FakeElement | null,
    elementFromPoint: () => env.under,
    addEventListener: (type: string, listener: Listener) => {
      if (!documentListeners.has(type)) documentListeners.set(type, new Set());
      documentListeners.get(type)?.add(listener);
    },
    removeEventListener: (type: string, listener: Listener) => documentListeners.get(type)?.delete(listener),
    defaultView: null as unknown,
  };
  fakeDocument.defaultView = { document: fakeDocument, HTMLIFrameElement: class {} };
  g.Element = FakeElement;
  g.document = fakeDocument;
  const win = (g.window ??= globalThis) as Record<string, unknown>;
  win.addEventListener = (type: string, listener: Listener) => {
    if (!windowListeners.has(type)) windowListeners.set(type, new Set());
    windowListeners.get(type)?.add(listener);
  };
  win.removeEventListener = (type: string, listener: Listener) => windowListeners.get(type)?.delete(listener);
  g.MutationObserver = class {
    constructor(private readonly callback: () => void) {}
    observe(): void { observers.add(this.callback); }
    disconnect(): void { observers.delete(this.callback); }
  };
  g.requestAnimationFrame = (callback: () => void) => frames.push(callback);
  g.cancelAnimationFrame = (id: number) => { frames[id - 1] = () => undefined; };
  return env;
}

/** Une carte d'accueil : sa racine (survolée), son IMAGE (l'ancre), sa légende, son plateau et ses étoiles. */
export function fakeCard(env: PointerEnv, options: { focusable?: boolean } = {}) {
  const root = new FakeElement("div", options.focusable ? { role: "button" } : {}, env);
  if (options.focusable) root.tabIndex = 0;
  const anchor = root.append(new FakeElement("div", { "data-card-visual": "" }, env));
  const image = anchor.append(new FakeElement("img", {}, env));
  const caption = root.append(new FakeElement("h3", {}, env));
  const stars = anchor.append(new FakeElement("div", { role: "group" }, env));
  const star = stars.append(new FakeElement("button", {}, env));
  const tray = anchor.append(new FakeElement("div", { role: "toolbar" }, env));
  const seen = tray.append(new FakeElement("button", { "aria-label": "Marquer comme vu" }, env));
  return { root, anchor, image, caption, stars, star, tray, seen };
}
