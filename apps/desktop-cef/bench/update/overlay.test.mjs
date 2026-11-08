// Tests de la surcouche (logique pure) : quand elle paraît, ce qu'elle dit. Node ≥ 22 :
//   node --test bench/update/overlay.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../web/shim/update-overlay.js", import.meta.url), "utf8");
const sandbox = { module: { exports: {} } };
vm.runInNewContext(src, sandbox);
const o = sandbox.module.exports;

const major = (over = {}) => ({ enabled: true, current: "1.0.0", phase: "ready", progress: 1, prompt: "toast",
  canMute: true, error: "", rolledBack: "", update: { version: "1.1.0", severity: "major", mandatory: false,
    install: true, notes: { fr: "• Un\n• Deux", en: "• One" }, notesUrl: "https://tentacle.tv/n" }, ...over });
const idle = { path: "/", video: false, audio: false, rolledBackSeen: false };

test("mineure : rien ne paraît", () => {
  assert.equal(o.viewFor({ ...major(), prompt: "none" }, idle), "none");
  assert.equal(o.viewFor(null, idle), "none");
});

test("majeure : attend la fin d'une lecture, vidéo ou musique", () => {
  assert.equal(o.viewFor(major(), idle), "toast");
  assert.equal(o.viewFor(major(), { ...idle, path: "/watch/abc" }), "waiting");
  assert.equal(o.viewFor(major(), { ...idle, video: true }), "waiting");
  assert.equal(o.viewFor(major(), { ...idle, audio: true }), "waiting");
});

test("sécurité : bloque tout de suite, même pendant la lecture", () => {
  const s = major({ prompt: "blocking", canMute: false, phase: "downloading", progress: 0.4,
    update: { ...major().update, mandatory: true, why: { fr: "Faille corrigée", en: "Fixed flaw" } } });
  assert.equal(o.viewFor(s, { ...idle, path: "/watch/x", video: true }), "blocking");
  const m = o.blockingModel(s, "fr");
  assert.equal(m.body, "Faille corrigée");
  assert.equal(m.progress, 0.4);
  assert.equal(m.primary.disabled, true);  // pas avant d'être prête
  assert.equal(o.blockingModel({ ...s, phase: "ready" }, "fr").primary.disabled, false);
  assert.equal(o.blockingModel({ ...s, phase: "ready" }, "en").primary.label, "Restart and install");
});

test("majeure prête : Redémarrer, Plus tard, Ne plus m'avertir, Nouveautés", () => {
  const m = o.toastModel(major(), "fr");
  assert.equal(m.title, "Tentacle 1.1.0 est prête");
  assert.equal(m.primary.action, "restart");
  assert.equal(m.secondary.action, "later");
  assert.deepEqual([...m.links.map((l) => l.action)], ["mute", "notes"]);
  assert.deepEqual([...m.lines], ["Un", "Deux"]);
  assert.equal(m.progress, null);
});

test("majeure en téléchargement : progression, pas encore de redémarrage", () => {
  const m = o.toastModel(major({ phase: "downloading", progress: 0.25 }), "fr");
  assert.equal(m.progress, 0.25);
  assert.equal(m.primary, null);
  assert.equal(o.toastModel(major({ phase: "staging", progress: null }), "fr").progress, "sweep");
  assert.equal(o.toastModel(major({ phase: "downloading", progress: null }), "fr").progress, "sweep");
});

test("obligatoire hors ligne : prévient sans bloquer, Réessayer", () => {
  const s = major({ prompt: "toast", phase: "failed", error: "network", canMute: false,
    update: { ...major().update, mandatory: true } });
  assert.equal(o.viewFor(s, idle), "toast");
  const m = o.toastModel(s, "fr");
  assert.equal(m.kind, "pending");
  assert.equal(m.primary.action, "retry");
  assert.equal(m.closable, false);
  assert.equal(o.toastModel({ ...s, error: "cannot-install:translocated" }, "fr").kind, "manual");
  const again = o.toastModel({ ...s, phase: "downloading", progress: 0.3, error: "" }, "fr");
  assert.equal(again.progress, 0.3);  // nouvel essai : progression, sans voile ni bouton
  assert.equal(again.primary, null);
  assert.match(again.body, /Nouvel essai/);
  assert.match(o.toastModel({ ...s, error: "cannot-install:translocated" }, "fr").body, /Applications/);
});

test("retour arrière : annoncé une fois, puis oublié", () => {
  const s = major({ prompt: "none", rolledBack: "1.1.0" });
  assert.equal(o.viewFor(s, idle), "rolledBack");
  assert.equal(o.viewFor(s, { ...idle, rolledBackSeen: true }), "none");
  assert.match(o.toastModel(s, "fr").body, /1\.1\.0 n'a pas pu démarrer/);
});

test("langue : celle de la page, sinon du stockage, sinon du système", () => {
  assert.equal(o.pickLang("en-US", null, "fr-FR"), "en");
  assert.equal(o.pickLang("", "fr", "en-US"), "fr");
  assert.equal(o.pickLang("", null, "de-DE"), "en");
  assert.equal(o.pickLang(undefined, undefined, undefined), "fr");
});
