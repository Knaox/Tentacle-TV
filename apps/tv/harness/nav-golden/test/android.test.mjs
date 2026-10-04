// Le banc sur Android TV : ce qui ne s'y joue pas (pavé tactile de la Siri Remote).
import assert from "node:assert/strict";
import test from "node:test";
import { androidSkipReason, touchpadOnly } from "../lib/android.mjs";

test("un balayage ou un glissé n'a pas d'équivalent sur la télécommande Android", () => {
  assert.equal(touchpadOnly("swipe:left"), true);
  assert.equal(touchpadOnly("pan:120,0,400"), true);
  assert.equal(touchpadOnly("holdright:1.5"), false);
  assert.equal(touchpadOnly("menu"), false);
});

test("un scénario au pavé tactile est ignoré sur Android, avec sa raison", () => {
  const touch = { start: { keys: ["down"] }, steps: [{ do: ["swipe:up", "pan:0,80"] }] };
  assert.match(androidSkipReason(touch), /pavé tactile de la Siri Remote \(swipe, pan\)/);
  const keys = { start: { keys: ["left"] }, steps: [{ do: "select" }, { do: "hold:1.2" }] };
  assert.equal(androidSkipReason(keys), null);
});
