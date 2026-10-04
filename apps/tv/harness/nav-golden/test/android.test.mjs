// Le mode Android TV du banc, sans appareil : les gestes et leurs codes.
import assert from "node:assert/strict";
import test from "node:test";
import { ANDROID_KEYCODES, LINUX_KEYCODES } from "../lib/android.mjs";
import { gestureError } from "../lib/remote.mjs";

test("chaque touche du vocabulaire a son code Android (sauf « activate », un ordre de l'agent)", () => {
  for (const key of ["up", "down", "left", "right", "select", "menu", "play", "home"]) {
    assert.equal(gestureError(key), null);
    assert.equal(typeof ANDROID_KEYCODES[key], "number", key);
  }
  // Menu de la Siri Remote = Retour d'Android ; OK = DPAD_CENTER.
  assert.equal(ANDROID_KEYCODES.menu, 4);
  assert.equal(ANDROID_KEYCODES.select, 23);
});

test("chaque maintien du vocabulaire a son code Linux (console de l'émulateur)", () => {
  for (const dir of ["", "up", "down", "left", "right"]) {
    assert.equal(gestureError(`hold${dir}:1.2`), null);
    assert.equal(typeof LINUX_KEYCODES[dir], "number", dir || "OK");
  }
  // KEY_SELECT (353) → DPAD_CENTER dans la disposition Generic.kl.
  assert.equal(LINUX_KEYCODES[""], 353);
});
