import assert from "node:assert/strict";
import { test } from "node:test";
import { assertAllowed, assertForeground, ForegroundError, keycodeOf, resumedPackage, splitAtChecks, USER_PACKAGE } from "../lib/keyGuard.mjs";

const PERF = "com.tentacletv.mobile.perf";
// Relevé à l'émulateur Android TV 12 (API 31), le 07/10.
const API31_APP = `    mResumedActivity: ActivityRecord{bbb2c2c u0 ${PERF}/com.tentacletv.MainActivity t4}
  ResumedActivity: ActivityRecord{bbb2c2c u0 ${PERF}/com.tentacletv.MainActivity t4}
  mFocusedApp=ActivityRecord{bbb2c2c u0 ${PERF}/com.tentacletv.MainActivity t4}`;
const API31_LAUNCHER = `    mResumedActivity: ActivityRecord{d6ac3c8 u0 com.google.android.tvlauncher/.MainActivity t3}
  ResumedActivity: ActivityRecord{d6ac3c8 u0 com.google.android.tvlauncher/.MainActivity t3}
  mFocusedApp=ActivityRecord{d6ac3c8 u0 com.google.android.tvlauncher/.MainActivity t3}`;

test("le premier plan se lit sur Android 12, 14 et 9-11", () => {
  assert.equal(resumedPackage(API31_APP), PERF);
  assert.equal(resumedPackage(API31_LAUNCHER), "com.google.android.tvlauncher");
  assert.equal(resumedPackage(`  topResumedActivity=ActivityRecord{1 u0 ${PERF}/com.tentacletv.MainActivity t9}`), PERF);
  assert.equal(resumedPackage(`    mResumedActivity: ActivityRecord{1 u0 ${PERF}/com.tentacletv.MainActivity t9}`), PERF);
});

test("rien de lisible, ou focus et activité reprise en désaccord : refus", () => {
  assert.equal(resumedPackage(""), null);
  assert.equal(resumedPackage(API31_APP.replace(`mFocusedApp=ActivityRecord{bbb2c2c u0 ${PERF}`, "mFocusedApp=ActivityRecord{x u0 com.android.tv.settings")), null);
  assert.throws(() => assertForeground(PERF, ""), ForegroundError);
  assert.throws(() => assertForeground(PERF, API31_LAUNCHER), /premier plan = com.google.android.tvlauncher/);
  assert.doesNotThrow(() => assertForeground(PERF, API31_APP));
});

test("l'app de l'utilisateur est refusée, sur tout appareil", () => {
  assert.throws(() => assertAllowed(USER_PACKAGE, ["tap:20"]), ForegroundError);
  assert.doesNotThrow(() => assertAllowed(PERF, ["tap:20", "wait:300", "hold:23:900"]));
});

test("les touches système sont refusées d'office", () => {
  for (const step of ["tap:3", "tap:26", "tap:82", "tap:176", "tap:223", "tap:187", "hold:3:600", "tap:82x2@300"]) {
    assert.throws(() => assertAllowed(PERF, ["tap:20", step]), /touche système refusée/, step);
  }
  assert.throws(() => assertAllowed(PERF, ["input keyevent 3"]), /pas illisible/);
  // 30 (B) ou 31 (C) ne sont pas 3 : le code entier compte.
  assert.doesNotThrow(() => assertAllowed(PERF, ["tap:30", "tap:31"]));
});

test("la séquence est coupée après chaque OK et chaque Retour", () => {
  assert.deepEqual(splitAtChecks(["tap:20", "wait:500", "tap:23", "tap:22x3@400", "tap:4", "hold:20:2500"]), [
    ["tap:20", "wait:500", "tap:23"],
    ["tap:22x3@400", "tap:4"],
    ["hold:20:2500"],
  ]);
  assert.deepEqual(splitAtChecks(["hold:23:900", "wait:1600", "tap:22x3@450"]), [["hold:23:900"], ["wait:1600", "tap:22x3@450"]]);
  assert.equal(keycodeOf("wait:300"), null);
  assert.equal(keycodeOf("tap:22x6@500"), 22);
});
