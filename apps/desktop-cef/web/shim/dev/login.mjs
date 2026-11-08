// Se connecte au front par SON formulaire, avec le compte de test du banc
// (`~/.cache/tentacle-cef/banc/comptes.json`, jamais affiché).
//   node web/shim/dev/login.mjs [admin|user]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Cdp, pageTarget } from "./cdp.mjs";

const who = process.argv[2] ?? "admin";
const cache = process.env.TENTACLE_CEF_CACHE ?? join(process.env.HOME, ".cache/tentacle-cef");
const account = JSON.parse(readFileSync(join(cache, "banc/comptes.json"), "utf8"))[who];
if (!account) throw new Error(`aucun compte « ${who} » dans comptes.json`);

const cdp = await Cdp.connect((await pageTarget()).webSocketDebuggerUrl);
try {
  // React suit la valeur par le setter natif + un évènement `input`.
  const result = await cdp.eval(`(async () => {
    const set = (el, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const user = document.querySelector('input[autocomplete="username"]');
    const pass = document.querySelector('input[autocomplete="current-password"]');
    if (!user || !pass) return "formulaire introuvable sur " + location.pathname;
    set(user, ${JSON.stringify(account.name)});
    set(pass, ${JSON.stringify(account.password)});
    (pass.form ?? document.querySelector("form")).requestSubmit();
    for (let i = 0; i < 50 && location.pathname === "/login"; i++) await new Promise((r) => setTimeout(r, 200));
    return location.pathname;
  })()`);
  console.log(`après connexion : ${result}`);
} finally {
  cdp.close();
}
