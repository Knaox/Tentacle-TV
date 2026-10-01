// La série : capturer les écrans au banc (une langue à la fois — l'instantané
// suit la langue), puis composer les images App Store et les visuels du site.
import fs from "node:fs";
import path from "node:path";
import { appstoreHtml, APPSTORE_SIZE } from "../compose/appstoreTemplate.mjs";
import { stageHtml, STAGE_SIZE } from "../compose/siteTemplate.mjs";
import { capture, up } from "./bench.mjs";
import { APPSTORE_OUT, CAPTURES, ROOT, SITE_OUT } from "./paths.mjs";
import { describe, renderPng } from "./render.mjs";

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
export const appstoreScreens = () => readJson("compose/appstore.json").screens;
export const siteVisuals = () => readJson("compose/site.json").visuals;

export const captureFile = (lang, id) => path.join(CAPTURES, lang, `${id}.png`);

/** Capture les écrans demandés (par défaut : toute la série) dans une langue. */
export async function captureScreens(lang, only = null) {
  const screens = appstoreScreens().filter((screen) => !only || only.includes(screen.id));
  const udid = await up(lang);
  for (const screen of screens) {
    const file = captureFile(lang, screen.id);
    await capture(udid, { scene: screen.scene, focus: screen.focus ?? null, lang, glass: screen.glass ?? "on", settleMs: screen.settleMs ?? 900 }, file);
    console.log(`capturé ${lang}/${screen.id} (${screen.scene}${screen.focus ? ` · ${screen.focus}` : ""}) — ${describe(file)}`);
  }
}

/** Compose les images App Store d'une langue : 3840×2160, RVB sans alpha. */
export async function composeAppStore(lang, only = null) {
  const out = [];
  for (const screen of appstoreScreens().filter((s) => !only || only.includes(s.id))) {
    const shot = captureFile(lang, screen.id);
    if (!fs.existsSync(shot)) throw new Error(`capture absente : ${shot} — « vitrine.mjs capture --lang=${lang} »`);
    const file = path.join(APPSTORE_OUT, lang, `${screen.id}.png`);
    await renderPng(appstoreHtml({ capture: shot, headline: screen.headline[lang], lang }), file, { ...APPSTORE_SIZE, background: "#05050a" });
    const info = describe(file);
    if (info !== "3840x2160 srgb") throw new Error(`format refusé pour ${file} : ${info} (attendu 3840x2160 srgb, sans alpha)`);
    console.log(`App Store ${lang}/${screen.id}.png — ${info}`);
    out.push(file);
  }
  return out;
}

/** Les visuels du site d'une langue (compositions mises en scène). */
export async function composeSite(lang, only = null) {
  const out = [];
  for (const visual of siteVisuals().filter((v) => !only || only.includes(v.id))) {
    const file = path.join(SITE_OUT, lang, `${visual.id}.png`);
    if (visual.type === "stage") {
      const shots = Object.fromEntries(Object.entries(visual.screens).map(([slot, id]) => [slot, captureFile(lang, id)]));
      await renderPng(stageHtml({ ...shots, lang }), file, STAGE_SIZE);
    }
    console.log(`site ${lang}/${visual.id}.png — ${describe(file)}`);
    out.push(file);
  }
  return out;
}
