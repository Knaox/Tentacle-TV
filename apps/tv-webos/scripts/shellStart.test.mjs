/**
 * La coquille démarre-t-elle ? Joué sur les VRAIS fichiers de `shell/`.
 *
 * La coquille est de l'ES5 sans build ni typecheck : ses modules se parlent
 * par des noms posés sur `window`, et un renommage qui en oublie un ne casse
 * rien à la compilation. Le 29/08, `demarrerCoquille` est devenu `startShell`
 * dans `shell.js` mais pas dans `index.html`, et `ShellStorage.lire` n'a pas
 * suivi `read` : l'application restait figée sur son logo, sans une erreur
 * visible — vu seulement sur une dalle, à la republication de l'IPK.
 *
 * Ce test vit hors de `shell/` parce qu'`ares-package` embarque le dossier
 * entier dans le paquet. Il charge les scripts dans l'ordre de `index.html`,
 * exécute le script en ligne, puis déroule le jumelage jusqu'à la navigation
 * — chaque méthode que les modules s'appellent entre eux est donc traversée.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const SHELL = resolve(dirname(fileURLToPath(import.meta.url)), "../shell");
const HTML = readFileSync(resolve(SHELL, "index.html"), "utf8");

class FakeNode {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.className = "";
    this.attributes = {};
    this.style = {};
    this.ownText = "";
    this.id = "";
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    this.children = this.children.filter((node) => node !== child);
    return child;
  }
  get firstChild() {
    return this.children[0] ?? null;
  }
  set textContent(value) {
    this.children = [];
    this.ownText = String(value);
  }
  get textContent() {
    return this.ownText + this.children.map((node) => node.textContent).join("");
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  get classList() {
    const list = () => this.className.split(/\s+/).filter(Boolean);
    return {
      add: (name) => { if (!list().includes(name)) this.className = [...list(), name].join(" "); },
      remove: (name) => { this.className = list().filter((item) => item !== name).join(" "); },
      contains: (name) => list().includes(name),
    };
  }
  *walk() {
    yield this;
    for (const child of this.children) if (child instanceof FakeNode) yield* child.walk();
  }
}

/** Un document réduit à ce que la coquille touche, et une horloge manuelle. */
function createShellWindow({ remembered } = {}) {
  const body = new FakeNode("body");
  // Les identifiants que la page déclare : le contrat HTML ↔ JS est vérifié
  // au passage, `getElementById` ne trouvant que ce que `index.html` pose.
  for (const [, id] of HTML.matchAll(/\sid="([^"]+)"/g)) {
    const node = new FakeNode("div");
    node.id = id;
    body.appendChild(node);
  }
  const listeners = {};
  const document = {
    body,
    activeElement: null,
    hidden: false,
    createElement: (tag) => {
      const node = new FakeNode(tag);
      node.focus = () => { document.activeElement = node; };
      return node;
    },
    createTextNode: (text) => ({ textContent: String(text) }),
    getElementById: (id) => [...body.walk()].find((node) => node.id === id) ?? null,
    getElementsByTagName: (tag) =>
      [...body.walk()].filter((node) => node.tagName === tag.toUpperCase()),
    addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); },
  };

  const requests = [];
  class FakeXhr {
    open(method, url) { this.method = method; this.url = url; this.readyState = 1; }
    send() { requests.push(this); }
    reply(status, payload) {
      this.status = status;
      this.responseText = JSON.stringify(payload);
      this.readyState = 4;
      this.onreadystatechange?.();
    }
  }

  let now = 0;
  let timers = [];
  let nextId = 1;
  const schedule = (fn, delay, repeat) => {
    const id = nextId++;
    timers.push({ id, fn, at: now + (delay || 0), every: repeat ? delay : 0 });
    return id;
  };
  const cancel = (id) => { timers = timers.filter((timer) => timer.id !== id); };
  const advance = (ms) => {
    const end = now + ms;
    for (;;) {
      const due = timers.filter((timer) => timer.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      now = due.at;
      if (due.every) due.at += due.every; else cancel(due.id);
      due.fn();
    }
    now = end;
  };

  const store = new Map(remembered ? [["tentacle_webos_serveur", remembered]] : []);
  const location = { href: "file:///index.html" };
  const window = {
    document,
    navigator: { language: "fr-FR" },
    location,
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    },
    XMLHttpRequest: FakeXhr,
    setTimeout: (fn, delay) => schedule(fn, delay, false),
    setInterval: (fn, delay) => schedule(fn, delay, true),
    clearInterval: cancel,
    clearTimeout: cancel,
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [now])); }
    },
    Math,
    JSON,
    String,
    Object,
    encodeURIComponent,
  };
  window.window = window;
  const context = vm.createContext(window);

  // Les scripts dans l'ordre de la page, puis le script en ligne — celui qui
  // démarre tout. `webOSTV.js` n'est pas versionné (bibliothèque du SDK LG) :
  // absent sur le disque, il l'est aussi sur la dalle quand on ne l'a pas posé.
  const sources = [...HTML.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);
  for (const source of sources) {
    let code;
    try {
      code = readFileSync(resolve(SHELL, source), "utf8");
    } catch {
      continue;
    }
    vm.runInContext(code, context, { filename: source });
  }
  const start = () => {
    for (const [, inline] of HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      vm.runInContext(inline, context, { filename: "index.html" });
    }
  };
  const step = () => document.getElementById("etape-jumelage");
  return { window, document, requests, advance, start, step, location };
}

describe("coquille webOS — démarrage", () => {
  it("le script en ligne de la page démarre la coquille, et le jumelage part", () => {
    const shell = createShellWindow();
    expect(shell.start).not.toThrow();
    expect(shell.document.body.classList.contains("attente")).toBe(true);
    expect(shell.requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      "POST https://pair.tentacletv.app/generate",
    ]);
  });

  it("déroule code → expiration → nouveau code → confirmation → navigation", () => {
    const shell = createShellWindow();
    shell.start();
    shell.requests[0].reply(200, { code: "AB12", expiresIn: 300 });
    expect(shell.step().textContent).toContain("AB12");
    expect(shell.step().textContent).toContain("5:00");

    // Le sondage répond « expiré » : l'écran l'annonce et propose un nouveau code.
    shell.advance(3000);
    const poll = shell.requests.at(-1);
    expect(poll.url).toBe("https://pair.tentacletv.app/status/AB12");
    poll.reply(200, { status: "expired" });
    expect(shell.step().textContent).toContain("Code expiré");
    shell.advance(0);
    const retry = shell.document.activeElement;
    expect(retry?.tagName).toBe("BUTTON");

    retry.onclick();
    shell.requests.at(-1).reply(200, { code: "CD34", expiresIn: 300 });
    shell.advance(3000);
    shell.requests.at(-1).reply(200, {
      status: "confirmed",
      serverUrl: "http://serveur.local:3000",
      token: "jeton-de-test",
      user: { id: "u1", name: "Alice" },
    });
    expect(shell.window.localStorage.getItem("tentacle_webos_serveur")).toBe(
      "http://serveur.local:3000",
    );
    expect(shell.location.href).toMatch(
      /^http:\/\/serveur\.local:3000\/tv\/\?relance=\d+#jeton=jeton-de-test&u=u1&n=Alice$/,
    );
  });

  it("un serveur mémorisé est vérifié, puis rejoint sans rejumelage", () => {
    const shell = createShellWindow({ remembered: "http://serveur.local:3000" });
    shell.start();
    const health = shell.requests[0];
    expect(`${health.method} ${health.url}`).toBe("GET http://serveur.local:3000/api/health");
    health.status = 200;
    health.readyState = 4;
    health.onreadystatechange();
    expect(shell.location.href).toMatch(/^http:\/\/serveur\.local:3000\/tv\/\?relance=\d+$/);
  });
});
