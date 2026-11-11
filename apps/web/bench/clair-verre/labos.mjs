#!/usr/bin/env node
/**
 * Banc « clair-verre » : le CONTRASTE des écrans que le compte de banc n'atteint pas — l'administration,
 * « Qui regarde ? », la connexion, l'assistant, les réglages d'un bureau et d'une famille (labo des réglages) ;
 * la feuille « télécharger », la file, le catalogue gardé, les fiches locales (labo du hors ligne).
 *
 *   node bench/clair-verre/labos.mjs [dossier de captures] [reglages|hors-ligne]      (depuis apps/web)
 *
 * Ces deux labos ne se rendent pour de bon que dans la page de LEUR banc (`bench/reglages/`, `bench/hors-ligne/` :
 * construite par `vite build`, avec leur faux serveur ou leur pont factice). Ouverts dans le client de dev,
 * l'administration retombe sur « Lecture » (le compte réel n'est pas administrateur) et le hors ligne n'affiche
 * qu'un avis — c'est cela qu'`audit.mjs` mesurerait. Ici chaque page est construite et servie comme le fait son
 * banc, puis mesurée par la même règle que le reste (`lib/contrast.mjs`), en clair et en sombre, écran par écran.
 *
 * WEB=<racine d'un autre apps/web> : mesurer un autre code (la base), VITE_BIN son Vite s'il est hors de l'espace
 * de travail ; SKIP_BUILD=1 : les pages déjà construites ; THEME=light|dark : un seul thème ; TOP : défauts listés.
 * Code de sortie 1 s'il reste un défaut.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "playwright-core";

import { failures, measureViewport, summarize } from "./lib/contrast.mjs";

const WEB = resolve(process.env.WEB ?? join(dirname(fileURLToPath(import.meta.url)), "../.."));
const [outArg, only] = process.argv.slice(2);
const OUT = outArg ? resolve(outArg) : null;
if (OUT) mkdirSync(OUT, { recursive: true });
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml",
  ".webp": "image/webp", ".png": "image/png", ".json": "application/json",
};

/** Les plans du labo des réglages : ceux de son banc (`shots.mjs`), gestes compris — sans les cadrages partiels. */
async function settingsShots() {
  const { SHOTS } = await import(pathToFileURL(join(WEB, "bench/reglages/shots.mjs")).href);
  return SHOTS.filter((shot) => !shot.clip).map((shot) => ({
    name: shot.name, query: { vue: shot.vue, lang: "fr", ...(shot.params ?? {}) }, ready: shot.ready ?? "h1", settle: shot.settle ?? 500, act: shot.act,
  }));
}

/** Chaque vue du labo du hors ligne, dans les états de la file qui changent ce qu'on lit. */
const OFFLINE_SHOTS = [
  "vue=feuille-film", "vue=feuille-film&espace=refus", "vue=feuille-episode", "vue=feuille-saison", "vue=feuille-serie", "vue=suppression",
  ...["debut", "milieu", "pause", "erreur", "echec", "preparation", "vide"].map((state) => `vue=file&etat=${state}`),
  "vue=catalogue", "vue=catalogue&etat=vide", "vue=serie", "vue=film", "vue=boutons", "vue=avis", "vue=avis&reseau=coupe",
].map((query) => ({ name: query.replace(/vue=|etat=|espace=|reseau=/g, "").replace(/&/g, "-"), query: Object.fromEntries(new URLSearchParams(query)), ready: "[data-lab-view]", settle: 900 }));

const LABS = [
  { id: "reglages", dir: "bench/reglages", shots: await settingsShots(), disk: false },
  { id: "hors-ligne", dir: "bench/hors-ligne", shots: OFFLINE_SHOTS, disk: true },
].filter((lab) => !only || lab.id === only);

const themes = process.env.THEME === "light" || process.env.THEME === "dark" ? [process.env.THEME] : ["light", "dark"];
const report = [];
let total = 0;
for (const lab of LABS) {
  const dir = join(WEB, lab.dir);
  const dist = join(tmpdir(), `tentacle-clair-verre-${lab.id}-${process.env.WEB ? "autre" : "ici"}`);
  if (!process.env.SKIP_BUILD) {
    const [bin, ...lead] = process.env.VITE_BIN ? [process.env.VITE_BIN] : ["pnpm", "exec", "vite"];
    execFileSync(bin, [...lead, "build", "--config", join(dir, "vite.config.ts"), "--outDir", dist], { cwd: WEB, stdio: ["ignore", "ignore", "inherit"] });
  }
  // Le « disque » du hors ligne : les visuels d'un titre gardé, tels que le serveur local du bureau les sert.
  const disk = lab.disk ? JSON.parse(readFileSync(join(dir, "disk.json"), "utf8")) : null;
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const kept = disk ? /^\/disk\/meta\/([^/]+)\/([^/]+)$/.exec(pathname) : null;
    const path = kept ? (disk[kept[1]]?.[kept[2]] ? join(dir, "img", disk[kept[1]][kept[2]]) : "") : join(dist, pathname.replace(/\/$/, "/index.html"));
    if (path === "" || !(path.startsWith(dist) || path.startsWith(dir)) || !existsSync(path) || statSync(path).isDirectory()) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" }).end(readFileSync(path));
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const host = `${lab.id}.localhost`;
  const base = `http://${host}:${server.address().port}/`;
  const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--disable-audio-output", `--host-resolver-rules=MAP ${host} 127.0.0.1`] });

  for (const theme of themes) {
    for (const shot of lab.shots) {
      const name = `${lab.id}-${shot.name}`;
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: theme, locale: "fr-FR" });
      try {
        await page.goto(`${base}?${new URLSearchParams({ theme, ...shot.query })}`);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForSelector(shot.ready, { timeout: 15_000 });
        await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(shot.settle);
        if (shot.act) await shot.act(page);
        await page.evaluate(() => window.scrollTo(0, 0));
        const fails = [];
        let measured = 0;
        for (let screen = 0; screen < 5; screen++) {
          await page.waitForTimeout(350);
          if (OUT) await page.screenshot({ path: join(OUT, `${theme}-${name}-${screen}.png`) });
          const results = await measureViewport(page);
          measured += results.length;
          fails.push(...failures(results).map((f) => ({ ...f, screen })));
          const moved = await page.evaluate(() => { const before = scrollY; scrollBy(0, Math.round(innerHeight * 0.85)); return scrollY > before + 4; });
          if (!moved) break;
        }
        const groups = summarize(fails);
        total += groups.length;
        report.push({ scene: name, theme, measured, failing: fails.length, groups });
        console.log(`${groups.length === 0 ? "✓" : "✗"} ${theme} ${name} — ${measured} relevés, ${fails.length} en défaut (${groups.length} couples)`);
        for (const g of groups.slice(0, Number(process.env.TOP ?? 12))) {
          console.log(`    ${g.ratio.toFixed(2)}:1 < ${g.threshold}  ${g.kind} ${g.fg} sur ${g.bg} ×${g.count}  « ${g.samples.join(" | ")} »\n        ${g.path}`);
        }
      } catch (error) {
        total++;
        report.push({ scene: name, theme, error: error.message.split("\n")[0] });
        console.log(`! ${theme} ${name} — ${error.message.split("\n")[0]}`);
      }
      await page.close();
    }
  }
  await browser.close();
  server.close();
}
for (const theme of themes) {
  const rows = report.filter((r) => r.theme === theme && !r.error);
  console.log(`${theme} : ${rows.reduce((n, r) => n + r.failing, 0)} relevés en défaut sur ${rows.reduce((n, r) => n + r.measured, 0)}, ${rows.filter((r) => r.failing > 0).length} écrans sur ${rows.length}`);
}
if (OUT) writeFileSync(join(OUT, "rapport.json"), JSON.stringify({ date: new Date().toISOString(), report }, null, 1));
console.log(`${total} couples en défaut`);
process.exit(total === 0 ? 0 : 1);
