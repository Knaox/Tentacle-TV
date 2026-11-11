#!/usr/bin/env node
/**
 * Banc « clair-verre » : le texte posé sur une IMAGE, au pire dessous. L'image d'une bannière ou d'une fiche est
 * tirée au hasard : une passe ordinaire ne dit rien d'une image blanche. Ici, toutes les images de la page sont
 * rendues BLANCHES (puis NOIRES), et le contraste est mesuré comme d'habitude.
 *
 *   node bench/clair-verre/pire-image.mjs <route> [sélecteur du bloc à juger]      (depuis apps/web)
 *
 * THEME=light|dark, GLASS=1 comme `audit.mjs`. Code de sortie 1 s'il reste un défaut dans le bloc.
 */
import { failures, measureViewport, summarize } from "./lib/contrast.mjs";
import { openSession, visit } from "./lib/session.mjs";

const [route, scope] = process.argv.slice(2);
if (!route) throw new Error("usage : pire-image.mjs <route> [sélecteur]");
const theme = process.env.THEME === "dark" ? "dark" : "light";
const glass = process.env.GLASS === "1";
const { browser, page } = await openSession({ theme, glass });
await visit(page, route, 3500);
let total = 0;
for (const [name, filter] of [["blanche", "brightness(0) invert(1)"], ["noire", "brightness(0)"]]) {
  await page.addStyleTag({ content: `img, video { filter: ${filter} !important; }` });
  await page.waitForTimeout(500);
  const results = await measureViewport(page);
  const inScope = scope ? await page.evaluate((selector) => [...document.querySelectorAll(selector)].map((el) => { const r = el.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }), scope) : null;
  const kept = failures(results).filter((f) => !inScope || inScope.some(([l, t, r, b]) => f.rect[0] >= l - 1 && f.rect[1] >= t - 1 && f.rect[0] <= r && f.rect[1] <= b));
  const groups = summarize(kept);
  total += groups.length;
  console.log(`${groups.length === 0 ? "✓" : "✗"} image ${name} — ${results.length} relevés, ${kept.length} en défaut${scope ? ` dans « ${scope} »` : ""}`);
  for (const g of groups.slice(0, 14)) console.log(`    ${g.ratio.toFixed(2)}:1 < ${g.threshold}  ${g.kind} ${g.fg} sur ${g.bg} ×${g.count}  « ${g.samples.join(" | ")} »\n        ${g.path.split(" > ").slice(-2).join(" > ").slice(0, 200)}`);
}
await browser.close();
process.exit(total === 0 ? 0 : 1);
