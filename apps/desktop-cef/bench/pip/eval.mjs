// Évalue une expression dans la PAGE PRINCIPALE (tentacle://…), même quand le PiP est ouvert.
//   node bench/pip/eval.mjs [port] '<expression>'
import { Cdp } from "../../web/shim/dev/cdp.mjs";
const [port = "9426", expr = "location.pathname"] = process.argv.slice(2);
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const main = list.find((t) => t.type === "page" && t.url !== "about:blank");
if (!main) throw new Error("page principale introuvable");
const cdp = await Cdp.connect(main.webSocketDebuggerUrl);
console.log(JSON.stringify(await cdp.eval(expr), null, 1));
cdp.close();
