// Évalue une expression dans la page du Chrome du pont et imprime le résultat en JSON.
//   node web/shim/dev/cdp-eval.mjs 'window.tentacle.capabilities'
import { Cdp, pageTarget } from "./cdp.mjs";

const expression = process.argv[2];
if (!expression) throw new Error("usage : node cdp-eval.mjs '<expression>'");
const cdp = await Cdp.connect((await pageTarget()).webSocketDebuggerUrl);
try {
  console.log(JSON.stringify(await cdp.eval(expression), null, 2));
} finally {
  cdp.close();
}
