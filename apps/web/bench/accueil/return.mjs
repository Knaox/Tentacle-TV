#!/usr/bin/env node
/**
 * Mesure le RETOUR d'une fiche sur la vraie page d'accueil (serveur factice) : on ouvre une
 * page hors coquille, on revient, et l'on relève image par image ce que l'écran montre.
 *
 *   node bench/accueil/return.mjs      (depuis apps/web)
 *
 * Ce qui est lu, à chaque image après le retour :
 *   - l'opacité de la page revenue (l'enveloppe de `PageTransition`) — son entrée rejouée ;
 *   - les cartes À L'ÉCRAN dont l'image n'est pas peinte, pleine ;
 *   - les rangées à l'écran encore vides de cartes.
 * Médiane de `REPEAT` passes. Chrome sans tête, machine de développement : c'est une mesure de
 * COMPORTEMENT (ce qui clignote ou non), pas de fluidité.
 */

import { startBench } from "./serve.mjs";

const REPEAT = 5;
const FRAMES = 40;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const { base, browser, close } = await startBench();
const runs = [];
for (let i = 0; i < REPEAT; i += 1) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${base}?theme=dark&route=/`);
  await page.waitForSelector("[data-card-visual] img");
  await page.waitForTimeout(1500);
  runs.push(await page.evaluate(async (frames) => {
    const nextFrame = () => new Promise((done) => requestAnimationFrame(done));
    const onScreen = (el) => {
      const box = el.getBoundingClientRect();
      return box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth && box.width > 0;
    };
    const read = () => {
      const cards = [...document.querySelectorAll("[data-card-visual]")].filter(onScreen);
      const holes = cards.filter((card) => {
        const img = card.querySelector("img");
        return !img || !img.complete || Number(getComputedStyle(img).opacity) < 1;
      }).length;
      const rows = [...document.querySelectorAll("section[role='region']")].filter(onScreen);
      const emptyRows = rows.filter((row) => !row.querySelector("[data-card-visual]")).length;
      const wrapper = document.querySelector("[data-hero-frame]")?.closest("section")?.parentElement;
      return { cards: cards.length, holes, emptyRows, opacity: wrapper ? Number(getComputedStyle(wrapper).opacity) : -1 };
    };
    const before = read();
    window.__labNavigate("/media/sintel");
    while (!document.querySelector("[data-witness-detail]")) await nextFrame();
    for (let f = 0; f < 20; f += 1) await nextFrame();
    const start = performance.now();
    window.__labNavigate(-1);
    while (!document.querySelector("[data-hero-frame]")) await nextFrame();
    const backMs = performance.now() - start;
    const samples = [read()];
    for (let f = 0; f < frames; f += 1) {
      await nextFrame();
      samples.push(read());
    }
    const firstFull = samples.findIndex((s) => s.opacity >= 1 && s.holes === 0 && s.emptyRows === 0 && s.cards >= before.cards);
    return {
      cardsBefore: before.cards,
      backMs,
      framesFaded: samples.filter((s) => s.opacity < 1).length,
      framesWithHoles: samples.filter((s) => s.holes > 0).length,
      framesWithEmptyRows: samples.filter((s) => s.emptyRows > 0).length,
      framesWithFewerCards: samples.filter((s) => s.cards < before.cards).length,
      firstFullFrame: firstFull,
      head: samples.slice(0, 6).map((s) => `${s.cards}c/${s.holes}t/${s.emptyRows}v/${s.opacity.toFixed(2)}`),
    };
  }, FRAMES));
  await page.close();
}
await close();

const keys = ["cardsBefore", "backMs", "framesFaded", "framesWithHoles", "framesWithEmptyRows", "framesWithFewerCards", "firstFullFrame"];
const summary = Object.fromEntries(keys.map((key) => [key, Math.round(median(runs.map((run) => run[key])) * 10) / 10]));
console.log(JSON.stringify({ repeat: REPEAT, frames: FRAMES, summary, premieresImages: runs[0].head }, null, 2));
