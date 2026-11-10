#!/usr/bin/env node
// Sonde de la recette (axe navigateur) : évalue une expression dans la page de Tentacle CEF,
// avec un délai maximal (une boîte modale peut bloquer la page) et, au besoin, un geste
// utilisateur simulé (clipboard, window.open).
// Usage : node tests/recette/probe.mjs <port> '<expression>' [--timeout=ms] [--gesture]
import { Cdp, pageTarget } from "../../web/shim/dev/cdp.mjs";

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args.filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v ?? true];
  }),
);
const [port = "9425", expression = "document.title"] = args.filter((a) => !a.startsWith("--"));
const timeout = Number(flags.timeout ?? 8000);

const cdp = await Cdp.connect((await pageTarget(Number(port))).webSocketDebuggerUrl);
const timer = setTimeout(() => {
  console.log(JSON.stringify({ timeout: true }));
  cdp.close();
  process.exit(3);
}, timeout);
try {
  const r = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: Boolean(flags.gesture),
  });
  clearTimeout(timer);
  if (r.exceptionDetails) {
    console.log(JSON.stringify({ exception: r.exceptionDetails.exception?.description ?? r.exceptionDetails.text }));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(r.result.value ?? r.result, null, 1));
  }
} finally {
  cdp.close();
}
