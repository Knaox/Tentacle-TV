// L'appui long d'une carte du banc, par l'arbre React (Hermes, via l'inspecteur
// de Metro) : ouvre la feuille d'actions sans télécommande.
//   node cdp-longpress.mjs "<titre de la carte>" [filtre d'appareil]
//   METRO_PORT=8191 node cdp-longpress.mjs "Marée haute" sdk_google_atv
//
// Pourquoi : sur l'émulateur Android TV, `input keyevent --longpress` relâche
// OK au bout de ~400 ms, AVANT les 550 ms que le Pressable chronomètre en JS —
// l'appui long y vaut un simple OK. Sur tvOS, l'agent `../atv-remote` fait un
// vrai maintien (`hold:1.2`).
const [title, device = ""] = process.argv.slice(2);
if (!title) {
  console.log('usage : node cdp-longpress.mjs "<titre>" [filtre d\'appareil]');
  process.exit(2);
}
const port = Number(process.env.METRO_PORT ?? 8081);
const list = await (await fetch(`http://localhost:${port}/json/list`)).json();
const target = list.find((t) => /Bridge/.test(t.description) && t.title.includes(device));
if (!target) {
  console.log("aucune cible React Native", device ? `pour « ${device} »` : "");
  process.exit(1);
}

// La cellule de rangée (`RowCell`) porte l'item et `onLongPress` dans ses props.
const expression = `(function (name) {
  var hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook) return "pas de crochet React";
  var found = null;
  hook.renderers.forEach(function (_r, id) {
    hook.getFiberRoots(id).forEach(function (root) {
      var stack = [root.current];
      while (stack.length && !found) {
        var fiber = stack.pop();
        var props = fiber.memoizedProps;
        if (props && typeof props.onLongPress === "function" && props.item
          && (props.item.Name === name || props.item.title === name)) found = props;
        if (fiber.sibling) stack.push(fiber.sibling);
        if (fiber.child) stack.push(fiber.child);
      }
    });
  });
  if (!found) return "carte absente : " + name;
  found.onLongPress();
  return "appui long : " + name;
})(${JSON.stringify(title)})`;

const ws = new WebSocket(target.webSocketDebuggerUrl);
ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id !== 1) return;
  console.log(msg.result?.exceptionDetails ? "exception" : msg.result?.result?.value, `(${target.title})`);
  ws.close();
  process.exit(0);
};
setTimeout(() => {
  console.log("pas de réponse de l'inspecteur");
  process.exit(1);
}, 15000);
