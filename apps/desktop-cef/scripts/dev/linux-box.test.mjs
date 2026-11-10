// node --test apps/desktop-cef/scripts/dev/linux-box.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { boxCommand, boxDecision, logicalHomePath, parseBoxNames } from "./linux-box.mjs";

const LIST = `ID           | NAME                 | STATUS             | IMAGE
3a57a1aa42bf | gparted-box          | Exited (143) 2 months ago | registry.fedoraproject.org/fedora:latest
e2b7858d7237 | tentacle-cef         | Up 9 hours         | registry.fedoraproject.org/fedora:44`;

const host = { platform: "linux", inContainer: false, immutable: true, boxEnv: "", hasDistrobox: true, boxes: ["tentacle-cef"] };

test("les noms des boîtes se lisent dans la liste de distrobox", () => {
  assert.deepEqual(parseBoxNames(LIST), ["gparted-box", "tentacle-cef"]);
  assert.deepEqual(parseBoxNames(null), []);
});

test("hôte immuable avec sa boîte : le lanceur s'y rejoue", () => {
  assert.deepEqual(boxDecision(host), { kind: "enter", box: "tentacle-cef" });
});

test("déjà dans une boîte, coupé, ou pas Linux : on reste ici", () => {
  assert.equal(boxDecision({ ...host, inContainer: true }).kind, "none");
  assert.equal(boxDecision({ ...host, boxEnv: "off" }).kind, "none");
  assert.equal(boxDecision({ ...host, platform: "darwin" }).kind, "none");
});

test("hôte ordinaire : rien ne change, sauf si une boîte est demandée", () => {
  assert.equal(boxDecision({ ...host, immutable: false }).kind, "none");
  assert.deepEqual(boxDecision({ ...host, immutable: false, boxEnv: "ma-boite", boxes: ["ma-boite"] }), { kind: "enter", box: "ma-boite" });
});

test("hôte immuable sans l'outil ou sans la boîte : c'est dit, pas tenté", () => {
  assert.equal(boxDecision({ ...host, hasDistrobox: false, boxes: [] }).kind, "no-distrobox");
  assert.deepEqual(boxDecision({ ...host, boxes: ["gparted-box"] }), { kind: "no-box", box: "tentacle-cef" });
});

test("un chemin du dossier personnel est dit par son nom logique", () => {
  assert.equal(logicalHomePath("/var/home/k/depot/dev.mjs", "/home/k", "/var/home/k"), "/home/k/depot/dev.mjs");
  assert.equal(logicalHomePath("/var/home/kevin/dev.mjs", "/home/k", "/var/home/k"), "/var/home/kevin/dev.mjs");
  assert.equal(logicalHomePath("/usr/bin/node", "/home/k", "/var/home/k"), "/usr/bin/node");
  assert.equal(logicalHomePath("/home/k/dev.mjs", "/home/k", "/home/k"), "/home/k/dev.mjs");
});

test("la commande pose le dossier de Node et de pnpm en tête du PATH de la boîte", () => {
  const command = boxCommand("tentacle-cef", { node: "/n/bin/node", pnpm: "/p/bin/pnpm", script: "/s/dev.mjs", args: ["run", "--mute"] });
  assert.deepEqual(command.slice(0, 5), ["enter", "tentacle-cef", "--", "sh", "-c"]);
  assert.deepEqual(command.slice(6), ["/n/bin:/p/bin", "/n/bin/node", "/s/dev.mjs", "run", "--mute"]);
  assert.deepEqual(boxCommand("b", { node: "/n/bin/node", pnpm: "/n/bin/pnpm", script: "/s", args: [] }).slice(6), ["/n/bin", "/n/bin/node", "/s"]);
});
