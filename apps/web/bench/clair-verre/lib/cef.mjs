/**
 * La vraie coquille CEF, pilotée par son port CDP : la session d'un compte de banc y est posée comme dans le
 * Chrome du banc (jetons d'appareil), le thème et le réglage du verre aussi. La page se capture par CDP ; le verre
 * NATIF (sous la vue web) ne se voit que dans une capture de la FENÊTRE (`windowShot`), et un verre de fenêtre
 * inactive n'est pas celui d'une fenêtre active.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { chromium } from "playwright-core";

const TOKENS = process.env.BANC_TOKENS ?? join(homedir(), ".cache/tentacle-test/rf2/jetons/clair-verre.json");

/** Se branche sur l'app déjà lancée (`--devtools-port`) et y ouvre la session du compte de banc. */
export async function connectCef({ port = Number(process.env.BANC_CDP ?? 9413), origin = process.env.BANC_ORIGIN ?? "http://127.0.0.1:5413", theme = "dark", glass = true, account = "knaoxtest" } = {}) {
  const session = JSON.parse(readFileSync(TOKENS, "utf8"))[account];
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0];
  const page = context.pages().find((p) => p.url().startsWith(origin)) ?? context.pages()[0];
  await context.addCookies([{ name: "tentacle_token", value: session.token, url: origin }]);
  await page.evaluate(({ storage }) => { for (const key in storage) localStorage.setItem(key, storage[key]); }, {
    storage: {
      tentacle_token: session.token,
      tentacle_user: JSON.stringify(session.user),
      tentacle_theme_mode: theme,
      tentacle_liquid_glass: String(glass),
      tentacle_server_url: origin,
    },
  });
  return { browser, page, origin };
}

/** L'identifiant de la fenêtre de l'app (CoreGraphics), par le PID de son processus principal. */
export function windowId(pid) {
  const script = `import CoreGraphics
let pid = Int32(CommandLine.arguments[1])!
let list = CGWindowListCopyWindowInfo(.optionAll, kCGNullWindowID) as! [[String: Any]]
for w in list {
  if (w[kCGWindowOwnerPID as String] as? Int32) == pid, (w[kCGWindowLayer as String] as? Int) == 0,
     let b = w[kCGWindowBounds as String] as? [String: Any], (b["Height"] as? Double ?? 0) > 200 {
    print(w[kCGWindowNumber as String]!); break
  }
}`;
  return execFileSync("swift", ["-", String(pid)], { input: script, encoding: "utf8" }).trim() || null;
}

/** Capture la FENÊTRE (verre natif compris) — elle seule, jamais l'écran : rien d'une autre application n'y entre. */
export function windowShot(id, path) {
  execFileSync("screencapture", ["-x", "-o", "-l", String(id), path]);
}
