// `batcher.test.ts` d'Electron, porté sur le VRAI shim (`web/shim/tentacle-bridge.js`) joué
// dans un contexte isolé : `window.tentacle.liquidGlass` regroupe les changements d'une tâche
// en UN message, comme le preload. Sans dépendance : `node --test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../../../web/shim/tentacle-bridge.js", import.meta.url), "utf8");

/** Le shim posé avec `liquidGlass` ; les microtâches sont tenues à la main (`flush`). */
function load(liquidGlass = { refractsVideo: true }) {
  const sent = [];
  const pending = [];
  let scheduled = 0;
  const shell = {
    // Comme l'amorce du socle : la charge traverse en JSON (`bootstrap_js.h`).
    invoke(channel, payload) {
      sent.push({ channel, payload: JSON.parse(JSON.stringify(payload ?? null)) });
      return Promise.resolve(channel === "liquidGlass.sample" ? [0.5] : null);
    },
    on: () => () => undefined,
  };
  const window = { location: { origin: "tentacle://app" }, __shell: shell };
  window.top = window;
  const config = {
    origins: ["tentacle://app"], serverUrl: "", version: "1.42.0", platform: "darwin", titleBarHeight: 38,
    windowFocus: false, montage: "", windowing: "", liquidGlass, commands: [], events: [],
  };
  const context = {
    window,
    localStorage: { getItem: () => "déjà là", setItem: () => undefined },
    console,
    queueMicrotask: (fn) => {
      scheduled += 1;
      pending.push(fn);
    },
  };
  vm.runInNewContext(source.replace("__TENTACLE_SHIM_CONFIG__", JSON.stringify(config)), context);
  return {
    tentacle: window.tentacle,
    glass: window.tentacle.liquidGlass,
    sent,
    scheduled: () => scheduled,
    flush: () => pending.splice(0).forEach((fn) => fn()),
    batches: () => sent.filter((m) => m.channel === "liquidGlass.batch").map((m) => m.payload),
  };
}

const region = (id, extra = {}) => ({
  id, x: 10, y: 20, width: 300, height: 44, radius: 22, level: "regular", tint: null, interactive: false, z: 0, ...extra,
});

test("tout ce qu'une tâche envoie part en UN message", () => {
  const h = load();
  h.glass.setEnabled(true);
  h.glass.upsert([region("a"), region("b")]);
  h.glass.remove(["c"]);
  h.glass.upsert([region("d")]);
  assert.equal(h.scheduled(), 1);
  h.flush();
  assert.equal(h.batches().length, 1);
  assert.equal(h.batches()[0].enabled, true);
  assert.deepEqual(h.batches()[0].upserts.map((r) => r.id), ["a", "b", "d"]);
  assert.deepEqual(h.batches()[0].removes, ["c"]);
});

test("le dernier mot gagne, région par région", () => {
  const h = load();
  h.glass.upsert([region("a", { x: 1 })]);
  h.glass.upsert([region("a", { x: 2 })]);
  h.glass.upsert([region("b")]);
  h.glass.remove(["b"]);
  h.glass.remove(["c"]);
  h.glass.upsert([region("c")]);
  h.flush();
  const batch = h.batches()[0];
  assert.deepEqual(batch.upserts.map((r) => [r.id, r.x]), [["a", 2], ["c", 10]]);
  assert.deepEqual(batch.removes, ["b"]);
});

test("rien à dire, rien d'envoyé — et le lot suivant repart de zéro", () => {
  const h = load();
  h.flush();
  assert.equal(h.batches().length, 0);
  h.glass.upsert([region("a")]);
  h.flush();
  h.glass.remove(["a"]);
  h.flush();
  assert.equal(h.batches().length, 2);
  assert.deepEqual(h.batches()[1], { upserts: [], removes: ["a"] });
  assert.equal(h.scheduled(), 2);
});

test("ne recopie que les champs du protocole", () => {
  const h = load();
  h.glass.upsert([{ ...region("a", { group: "lecteur", transition: 200 }), onclick: () => 1, secret: "x" }]);
  h.flush();
  assert.deepEqual(Object.keys(h.batches()[0].upserts[0]).sort(),
    ["group", "height", "id", "interactive", "level", "radius", "tint", "transition", "width", "x", "y", "z"].sort());
});

test("laisse passer CHAQUE champ facultatif du protocole (vécu sous Electron : `materialize` perdu)", () => {
  const h = load();
  const full = {
    ...region("a"), group: "g", spacing: 8, transition: 340, spring: { response: 0.42, dampingFraction: 0.84 }, appearance: "dark",
    materialize: { rise: 6, scale: 0.96, originX: 0.5, originY: 1, delay: 30, exit: 180, enterEase: [0.2, 0.9, 0.3, 1], exitEase: [0.4, 0, 1, 1] },
  };
  h.glass.upsert([{ ...full, materialize: { ...full.materialize, extra: 1 } }]);
  h.flush();
  assert.deepEqual(h.batches()[0].upserts[0], full);
});

test("une entrée sans identifiant est ignorée, sans faire tomber le pont", () => {
  const h = load();
  h.glass.upsert([null, { x: 1 }, region("ok")]);
  h.glass.remove([42, "z"]);
  h.flush();
  assert.deepEqual(h.batches()[0].upserts.map((r) => r.id), ["ok"]);
  assert.deepEqual(h.batches()[0].removes, ["z"]);
});

test("(CEF) absent sans verre natif ; présent, il dit `supported` et `refractsVideo` ; la page qui naît le dit", () => {
  assert.equal(load(null).tentacle.liquidGlass, undefined);
  const h = load({ refractsVideo: false });
  assert.equal(h.glass.supported, true);
  assert.equal(h.glass.refractsVideo, false);
  assert.equal(load().glass.refractsVideo, true);
  assert.equal(h.sent.filter((m) => m.channel === "liquidGlass.pageStarted").length, 1);
  assert.equal(load(null).sent.filter((m) => m.channel.startsWith("liquidGlass")).length, 0);
  assert.ok(!h.tentacle.capabilities.some((c) => c.startsWith("liquid")), "hors de `capabilities`, comme Electron");
});

test("(CEF) sample : les rectangles partent tels quels, la réponse revient ; rien sans tableau", async () => {
  const h = load();
  assert.deepEqual(await h.glass.sample([{ x: 0, y: 0, width: 10, height: 10, under: "window" }]), [0.5]);
  assert.deepEqual(h.sent.at(-1), { channel: "liquidGlass.sample", payload: [{ x: 0, y: 0, width: 10, height: 10, under: "window" }] });
  assert.deepEqual([...(await h.glass.sample("tout"))], []);  // tableau du contexte du shim : recopié
  h.glass.setEnabled("oui");
  h.flush();
  assert.equal(h.batches()[0].enabled, false);
});
