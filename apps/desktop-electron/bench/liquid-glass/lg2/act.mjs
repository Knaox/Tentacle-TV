// Banc lg2 (testeur) : un geste sur l'app tenue par `hold.mjs`, par CDP.
//   node lg2/act.mjs <compte> <commande> [args…]
//   go <route> · shot <nom> · click <sélecteur> [motif] · hover <sélecteur> [motif]
//   key <touche> [meta] · eval <js> · inv · theme dark|light|auto · scroll <y>
import { readFileSync } from "node:fs";
import path from "node:path";
import { go, sleep } from "../lib/app.mjs";
import { Cdp, listTargets } from "../lib/cdp.mjs";
import { STATE } from "../lib/config.mjs";
import { PORTS } from "../lib/electron.mjs";
import { captureWindow, mainWindow } from "../lib/macos.mjs";
import { centerOf, clickAt, mouseTo } from "../lib/steps.mjs";
import { INVENTORY } from "./inventory.mjs";

const [who, cmd, ...args] = process.argv.slice(2);
const [, electronPid] = readFileSync(path.join(STATE, `hold-${who}.pid`), "utf8").trim().split(" ").map(Number);
const OUT = process.env.LG2_OUT ?? path.join(process.env.HOME, "Pictures/tentacle-banc-liquid-glass/lg2");
const target = (await listTargets(PORTS.page)).find((t) => t.type === "page" && t.url.startsWith("tentacle://app/"));
const page = await Cdp.connect(target.webSocketDebuggerUrl);
await page.send("Runtime.enable");
const main = await (async () => {
  const list = await (await fetch(`http://127.0.0.1:${PORTS.main}/json/list`)).json();
  return Cdp.connect(list[0].webSocketDebuggerUrl);
})();
const evalMain = async (body) => (await main.send("Runtime.evaluate", { expression: `(async () => { const require = process.mainModule.require; ${body} })()`, awaitPromise: true, returnByValue: true })).result?.value;

async function key(k, mods = 0) {
  const code = k.length === 1 ? `Key${k.toUpperCase()}` : k;
  for (const type of ["keyDown", "keyUp"]) await page.send("Input.dispatchKeyEvent", { type, key: k, code, modifiers: mods, windowsVirtualKeyCode: k === "Escape" ? 27 : k.toUpperCase().charCodeAt(0) });
}

try {
  switch (cmd) {
    case "go": await go(page, args[0], Number(args[1] ?? 2500)); console.log(await page.evaluate("return location.pathname")); break;
    case "shot": {
      const win = mainWindow(STATE, electronPid);
      console.log(captureWindow(win.id, path.join(OUT, `${args[0]}.png`)));
      break;
    }
    case "click": case "hover": {
      const at = await centerOf(page, args[0], args[1] ?? null);
      if (!at) { console.log("introuvable"); break; }
      if (cmd === "click") await clickAt(page, at.x, at.y); else await mouseTo(page, at.x, at.y);
      await sleep(Number(args[2] ?? 900));
      console.log(JSON.stringify(at));
      break;
    }
    case "move": await mouseTo(page, Number(args[0]), Number(args[1])); await sleep(600); break;
    case "clickxy": await clickAt(page, Number(args[0]), Number(args[1])); await sleep(900); break;
    case "key": await key(args[0], args[1] === "meta" ? 4 : 0); await sleep(900); break;
    case "eval": console.log(JSON.stringify(await page.evaluate(args.join(" ")), null, 1)); break;
    case "inv": console.log(JSON.stringify(await page.evaluate(INVENTORY), null, 1)); break;
    case "scroll": await page.evaluate(`(document.querySelector("main")?.scrollHeight > innerHeight ? document.querySelector("main") : document.scrollingElement).scrollTo(0, ${Number(args[0])}); return 1;`); await sleep(900); break;
    case "theme": {
      const mode = args[0];
      await page.evaluate(`localStorage.setItem("tentacle_theme_mode", ${JSON.stringify(mode)}); location.reload(); return 1;`).catch(() => {});
      console.log(await evalMain(`require("electron").nativeTheme.themeSource = ${JSON.stringify(mode === "auto" ? "system" : mode)}; return "ok";`));
      await sleep(5000);
      break;
    }
    case "emul": {
      const f = [];
      if (args[0]) f.push({ name: "prefers-reduced-transparency", value: args[0] === "1" ? "reduce" : "no-preference" });
      if (args[1]) f.push({ name: "prefers-contrast", value: args[1] === "1" ? "more" : "no-preference" });
      // L'émulation ne vit que le temps de la connexion CDP : on la pose, on mesure, on capture DANS la même commande.
      await page.send("Emulation.setEmulatedMedia", { features: f });
      await sleep(1500);
      console.log(JSON.stringify(await page.evaluate(args[3] ?? "return 0")));
      if (args[2]) { const win = mainWindow(STATE, electronPid); console.log(captureWindow(win.id, path.join(OUT, `${args[2]}.png`))); }
      break;
    }
    case "native": console.log(await evalMain(`require("electron").nativeTheme.themeSource = ${JSON.stringify(args[0])}; return require("electron").nativeTheme.shouldUseDarkColors;`)); await sleep(2500); break;
    default: console.log("commande inconnue");
  }
} finally {
  page.close();
  main.close();
}
