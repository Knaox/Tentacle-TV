#!/usr/bin/env node
/**
 * Banc « clair-verre » : UNE capture d'un écran, pour le regarder (Chrome du banc, session du compte de banc).
 *
 *   node bench/clair-verre/capture.mjs <fichier.png> <route>      (depuis apps/web)
 *
 * THEME=light|dark ; GLASS=1 (Liquid Glass, pont simulé) ; DPR=<densité> ; SETTLE=<ms> ; CLICK="sél1||sél2" (clics
 * avant la capture) ; SCROLL=<px> ; CLIP="x,y,l,h" ou CLIPS="x,y,l,h;…" (gros plans, un fichier par zone) ;
 * JS=<expression> (évaluée dans la page, imprimée). Pour juger un verre : BANC_NAVIGATEUR=complet.
 */
import { openSession, visit } from "./lib/session.mjs";
const [out, route, ...rest] = process.argv.slice(2);
const { browser, page, errors } = await openSession({ theme: process.env.THEME ?? "light", glass: process.env.GLASS === "1", scale: Number(process.env.DPR ?? 1) });
await visit(page, route ?? "/", Number(process.env.SETTLE ?? 3000));
if (process.env.JS) console.log(JSON.stringify(await page.evaluate(process.env.JS), null, 1));
if (process.env.CLICK) { for (const sel of process.env.CLICK.split("||")) { await page.locator(sel).first().click({ timeout: 5000 }).catch((e) => console.log("clic raté", sel, e.message.split("\n")[0])); await page.waitForTimeout(700); } }
if (process.env.SCROLL) { await page.evaluate((y) => { for (const el of [document.scrollingElement, ...document.querySelectorAll("main")]) if (el) el.scrollTop = y; }, Number(process.env.SCROLL)); await page.waitForTimeout(900); }
console.log(await page.evaluate(() => ({ url: location.pathname, theme: document.documentElement.dataset.theme, glass: document.documentElement.dataset.liquidGlass })));
const clip = process.env.CLIP ? (([x, y, width, height]) => ({ x, y, width, height }))(process.env.CLIP.split(",").map(Number)) : undefined;
if (process.env.CLIPS) { let i = 0; for (const c of process.env.CLIPS.split(";")) { const [x, y, width, height] = c.split(",").map(Number); await page.screenshot({ path: out.replace(/\.png$/, `-${i++}.png`), clip: { x, y, width, height } }); } }
else await page.screenshot({ path: out, clip });
if (errors.length) console.log(errors.slice(0, 5));
await browser.close();
