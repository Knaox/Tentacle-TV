// Un geste refusé par l'agent (un `type:` sans clavier ouvert) devient une
// erreur DU PAS, l'agent vivant ; et `{backend}` part résolu. Contre un faux
// agent HTTP (le serveur d'atv-remote rend `info: "error:…"`).
// `node --test "apps/tv/harness/nav-golden/test/*.test.mjs"`.
import assert from "node:assert/strict";
import http from "node:http";
import { after, test } from "node:test";
import { GestureError, gestureRefusal, perform } from "../lib/remote.mjs";

const received = [];
let answer = (commands) => commands.map((a) => ({ a, ms: 1 }));
const agent = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => {
    const commands = JSON.parse(body || "[]");
    received.push(...commands);
    res.end(JSON.stringify(answer(commands)));
  });
});
await new Promise((resolve) => agent.listen(0, "127.0.0.1", resolve));
after(() => new Promise((resolve) => agent.close(resolve)));
const ctx = { ports: { agentHttp: agent.address().port, backend: 3102 }, device: false };

test("l'info `error:…` d'un ordre est un refus ; tout le reste n'en est pas un", () => {
  assert.equal(gestureRefusal({ info: "error:no-keyboard-focus" }), "no-keyboard-focus");
  assert.equal(gestureRefusal({ info: "error:background:2" }), "background:2");
  assert.equal(gestureRefusal({ info: "" }), null);
  assert.equal(gestureRefusal({ info: "background:2" }), null); // la réponse d'un `focus` : pas un refus
  assert.equal(gestureRefusal(undefined), null);
});

test("un type: sans clavier : erreur DU GESTE (GestureError), message lisible", async () => {
  answer = (commands) => commands.map((a) => ({ a, info: "error:no-keyboard-focus" }));
  await assert.rejects(perform(ctx, "type:dune\n"), (error) => error instanceof GestureError && /aucun champ n'a le clavier/.test(error.message));
});

test("un type: accepté passe, et {backend} part résolu vers la place", async () => {
  answer = (commands) => commands.map((a) => ({ a, info: "" }));
  received.length = 0;
  assert.equal(await perform(ctx, "type:http://{backend}\n"), 0);
  assert.deepEqual(received, ["type:http://localhost:3102\n"]);
});
