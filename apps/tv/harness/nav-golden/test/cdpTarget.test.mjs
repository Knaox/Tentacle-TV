// Le choix de la cible Hermes (`lib/cdpTarget.mjs`) : une seule app relevée,
// jamais une au hasard. `node --test apps/tv/harness/nav-golden/test/`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ambiguityMessage, selectTarget } from "../lib/cdpTarget.mjs";

const page = (appId, deviceName, device, extra = {}) => ({
  id: `${device}-1`, appId, deviceName, title: appId, description: "React Native Bridge",
  webSocketDebuggerUrl: `ws://127.0.0.1:8185/inspector/debug?device=${device}&page=1`, reactNative: { logicalDeviceId: device }, ...extra,
});

test("aucune page de l'app attendue : on attend", () => {
  assert.equal(selectTarget([], { appId: "com.tentacle.mobile" }).state, "waiting");
  assert.equal(selectTarget([page("com.autre", "nav-T5", "d1")], { appId: "com.tentacle.mobile" }).state, "waiting");
});

test("le passage de T5 : l'app du simulateur ET l'app de test sur le même Metro — l'appareil seul est suivi", () => {
  const list = [page("com.tentacle.mobile", "nav-T5", "sim"), page("com.tentacle.mobile.navtest", "Chambre", "atv")];
  const chosen = selectTarget(list, { appId: "com.tentacle.mobile.navtest" });
  assert.equal(chosen.state, "ready");
  assert.equal(chosen.target.deviceName, "Chambre");
  assert.deepEqual(chosen.others.map((o) => o.deviceName), ["nav-T5"]);
});

test("deux appareils candidats : refus, avec les deux nommés", () => {
  const list = [page("com.tentacle.mobile", "nav-T5", "sim5"), page("com.tentacle.mobile", "nav-T2", "sim2")];
  const chosen = selectTarget(list, { appId: "com.tentacle.mobile" });
  assert.equal(chosen.state, "ambiguous");
  assert.equal(chosen.candidates.length, 2);
  const message = ambiguityMessage(chosen, { appId: "com.tentacle.mobile", metroPort: 8185 });
  assert.match(message, /plusieurs cibles Hermes/);
  assert.match(message, /nav-T5/);
  assert.match(message, /nav-T2/);
});

test("le nom d'appareil, s'il est donné, départage deux simulateurs", () => {
  const list = [page("com.tentacle.mobile", "nav-T5", "sim5"), page("com.tentacle.mobile", "nav-T2", "sim2")];
  const chosen = selectTarget(list, { appId: "com.tentacle.mobile", deviceName: "nav-T2" });
  assert.equal(chosen.state, "ready");
  assert.equal(chosen.target.reactNative.logicalDeviceId, "sim2");
});

test("un même appareil à deux pages : la page « React Native Bridge », pas une ambiguïté", () => {
  const list = [
    page("com.tentacle.mobile", "nav-T2", "sim2", { id: "sim2-2", description: "Hermes React Native" }),
    page("com.tentacle.mobile", "nav-T2", "sim2", { id: "sim2-1" }),
  ];
  const chosen = selectTarget(list, { appId: "com.tentacle.mobile" });
  assert.equal(chosen.state, "ready");
  assert.equal(chosen.target.id, "sim2-1");
});

test("une page sans adresse de débogage ne compte pas", () => {
  const list = [{ ...page("com.tentacle.mobile", "nav-T2", "sim2"), webSocketDebuggerUrl: undefined }];
  assert.equal(selectTarget(list, { appId: "com.tentacle.mobile" }).state, "waiting");
});
