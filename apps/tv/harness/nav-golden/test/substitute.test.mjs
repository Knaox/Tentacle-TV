// Les adresses de place (`lib/substitute.mjs`) : `type:http://{backend}` part
// vers le faux backend de la place qui joue, et le relevé n'en garde que le nom.
// `node --test "apps/tv/harness/nav-golden/test/*.test.mjs"`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { gestureError } from "../lib/remote.mjs";
import { normalizeObservation, resolveGesture, substitutionsFor, unknownPlaceholders } from "../lib/substitute.mjs";

const sim7 = substitutionsFor({ ports: { backend: 3107 } });
const sim2 = substitutionsFor({ ports: { backend: 3102 } });
const atv9 = substitutionsFor({ ports: { backend: 3109 }, device: true, macIp: "172.16.1.175" });

test("au simulateur, {backend} est le faux backend de la place, sur localhost", () => {
  assert.equal(resolveGesture("type:http://{backend}\n", sim7), "type:http://localhost:3107\n");
  assert.equal(resolveGesture("type:http://{backend}\n", sim2), "type:http://localhost:3102\n");
});

test("sur l'Apple TV, {backend} est l'IP du Mac (localhost y désigne la télévision)", () => {
  assert.equal(resolveGesture("type:http://{backend}\n", atv9), "type:http://172.16.1.175:3109\n");
});

test("un geste sans adresse part tel quel", () => {
  assert.equal(resolveGesture("type:dune\n", sim7), "type:dune\n");
});

test("une adresse inconnue est refusée par check, avant tout lancement", () => {
  assert.deepEqual(unknownPlaceholders("type:http://{serveur}"), ["serveur"]);
  assert.match(gestureError("type:http://{serveur}"), /adresse inconnue/);
  assert.equal(gestureError("type:http://{backend}\n"), null);
});

test("le relevé ramène l'adresse de la place à son nom, à toute profondeur", () => {
  const obs = {
    focus: "pairing:url", label: "Adresse du serveur, http://localhost:3107",
    storage: { tentacle_server_url: "http://localhost:3107" }, writes: ["POST /api/pair/login"], frame: [1, 2, 3, 4],
  };
  const normalized = normalizeObservation(obs, sim7);
  assert.equal(normalized.label, "Adresse du serveur, http://{backend}");
  assert.equal(normalized.storage.tentacle_server_url, "http://{backend}");
  assert.deepEqual(normalized.frame, [1, 2, 3, 4]);
  assert.deepEqual(normalized.writes, ["POST /api/pair/login"]);
});

test("deux places, un même relevé : la référence ne dépend pas de la place", () => {
  const onSlot7 = normalizeObservation({ label: "http://localhost:3107" }, sim7);
  const onDevice = normalizeObservation({ label: "http://172.16.1.175:3109" }, atv9);
  assert.deepEqual(onSlot7, onDevice);
});

test("l'adresse d'une AUTRE place n'est pas touchée (elle ne vise pas le banc qui joue)", () => {
  assert.equal(normalizeObservation({ label: "http://localhost:3107" }, sim2).label, "http://localhost:3107");
});
