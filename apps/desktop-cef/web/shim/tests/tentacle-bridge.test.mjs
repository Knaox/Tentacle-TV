// window.tentacle tel que le pose web/shim/tentacle-bridge.js, comparé au preload d'Electron
// (`apps/desktop-electron/src/preload/index.ts`) : portage de `windowFocusBridge.test.ts` et des
// capacités nommées (openExternal, pickFolder, relaunch). `node --test`, sans dépendance.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../tentacle-bridge.js", import.meta.url), "utf8");

/** Pose le shim dans un faux contexte de page ; rend la page et le faux natif. */
function install(overrides = {}) {
  const config = {
    origins: ["tentacle://app"],
    serverUrl: "",
    version: "1.42.0",
    platform: "darwin",
    titleBarHeight: 38,
    windowFocus: true,
    montage: "",
    windowing: "",
    commands: ["app_link_take", "toggle_fullscreen"],
    events: ["app-link"],
    ...overrides,
  };
  const calls = [];
  const listeners = new Map();
  const replies = { "lifecycle.windowFocus.get": false, ...(overrides.replies ?? {}) };
  const shell = {
    invoke(channel, payload) {
      calls.push([channel, payload]);
      const reply = replies[channel];
      return typeof reply === "function" ? reply(payload) : Promise.resolve(reply ?? null);
    },
    on(event, cb) {
      listeners.set(event, cb);
      return () => listeners.delete(event);
    },
  };
  const store = new Map();
  const window = { location: { origin: overrides.origin ?? "tentacle://app" }, __shell: shell };
  window.top = window;
  const context = vm.createContext({
    window,
    console,
    Promise,
    Set,
    Object,
    Number,
    String,
    Error,
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
  });
  vm.runInContext(source.replace("__TENTACLE_SHIM_CONFIG__", JSON.stringify(config)), context);
  return { tentacle: window.tentacle, calls, push: (event, value) => listeners.get(event)?.(value) };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("la forme du preload : version, plateforme, capacités gelées, bande de 38", () => {
  const { tentacle } = install();
  assert.equal(tentacle.version, "1.42.0");
  assert.equal(tentacle.platform, "darwin");
  assert.deepEqual([...tentacle.capabilities], ["app_link_take", "toggle_fullscreen"]);
  assert.ok(Object.isFrozen(tentacle.capabilities) && Object.isFrozen(tentacle));
  assert.equal(tentacle.titleBarHeight, 38);
  assert.equal(install({ titleBarHeight: Number.NaN }).tentacle.titleBarHeight, 0);
  assert.equal(install({ titleBarHeight: -4 }).tentacle.titleBarHeight, 0);
});

test("seule l'origine choisie reçoit le pont", () => {
  assert.equal(install({ origin: "https://exemple.fr" }).tentacle, undefined);
});

test("une commande hors liste est refusée, comme la liste fermée d'Electron", async () => {
  const { tentacle } = install();
  await assert.rejects(tentacle.invoke("downloads_list"), /canal refuse: downloads_list/);
});

test("openExternal, pickFolder, relaunch : capacités nommées, hors de la liste", async () => {
  const { tentacle, calls } = install({ replies: { "tentacle:pick-folder": "/Volumes/Films" } });
  assert.equal(await tentacle.openExternal("https://tentacletv.app"), undefined);
  assert.equal(await tentacle.pickFolder(), "/Volumes/Films");
  await tentacle.relaunch();
  const sent = calls.map(([c]) => c);
  assert.ok(sent.includes("tentacle:open-external") && sent.includes("tentacle:pick-folder") && sent.includes("tentacle:relaunch"));
  // Objet né dans le contexte de la page (autre royaume) : comparé par sa forme JSON.
  assert.equal(JSON.stringify(calls.find(([c]) => c === "tentacle:open-external")[1]), '{"url":"https://tentacletv.app"}');
  assert.ok(!tentacle.capabilities.includes("open-external"));
  assert.equal(await install({ replies: { "tentacle:pick-folder": null } }).tentacle.pickFolder(), null);
});

test("un nouveau document le dit au natif (les liens d'app attendent app_link_take)", () => {
  const { calls } = install();
  assert.ok(calls.some(([c]) => c === "lifecycle.pageStarted"));
});

test("windowFocus : la valeur du natif, puis seulement les CHANGEMENTS", async () => {
  const { tentacle, push } = install({ replies: { "lifecycle.windowFocus.get": true } });
  assert.equal(tentacle.windowFocus.isFocused(), false);
  await tick();
  assert.equal(tentacle.windowFocus.isFocused(), true);
  const seen = [];
  const off = tentacle.windowFocus.subscribe((f) => seen.push(f));
  push("lifecycle.windowFocus", true);
  push("lifecycle.windowFocus", false);
  push("lifecycle.windowFocus", false);
  off();
  push("lifecycle.windowFocus", true);
  assert.deepEqual(seen, [false]);
  assert.equal(tentacle.windowFocus.isFocused(), true);
});

test("windowFocus : ce qui n'est pas un booléen est ignoré, un abonné qui lève ne prive pas les autres", () => {
  const { tentacle, push } = install();
  const seen = [];
  tentacle.windowFocus.subscribe(() => {
    throw new Error("abonné fautif");
  });
  tentacle.windowFocus.subscribe((f) => seen.push(f));
  push("lifecycle.windowFocus", "oui");
  push("lifecycle.windowFocus", null);
  push("lifecycle.windowFocus", true);
  assert.deepEqual(seen, [true]);
});

test("windowFocus : un abonné qui n'est pas une fonction est refusé sans erreur ; absent hors macOS", () => {
  const { tentacle } = install();
  const off = tentacle.windowFocus.subscribe(42);
  assert.doesNotThrow(() => off());
  assert.equal(install({ windowFocus: false, platform: "linux" }).tentacle.windowFocus, undefined);
});

test("montage et fenetrage : seulement sous Linux, seulement des valeurs connues", () => {
  const linux = install({ platform: "linux", windowFocus: false, montage: "wayland", windowing: "libre" }).tentacle;
  assert.equal(linux.montage, "wayland");
  assert.equal(linux.fenetrage, "libre");
  const mac = install().tentacle;
  assert.ok(!("montage" in mac) && !("fenetrage" in mac));
  assert.ok(!("montage" in install({ montage: "x12" }).tentacle));
});
