/**
 * Page du banc « sortie et retour de la coquille » (construite en PRODUCTION
 * par `run.mjs`).
 *
 * Ce que l'application fait quand on ouvre une fiche depuis l'accueil, avec
 * ses vrais mécanismes : `AnimatedRoutes` fait SORTIR toute la coquille
 * (`routeKeys` : `/media` est hors coquille), la démonte, puis la REMONTE au
 * retour. La coquille est ici un gabarit — une barre et `ROWS` rangées de
 * `CARDS` affiches —, mais chaque affiche est la vraie `CardImage`, sous la
 * vraie `PageTransition`.
 *
 * `window.__bench.run()` joue accueil → fiche → retour et rend ce qu'il a
 * mesuré : le coût du remontage, et les images à l'écran où une affiche DÉJÀ
 * VUE manque (le clignotement).
 */
import { useEffect, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, useNavigate, type NavigateFunction } from "react-router-dom";

import "./bench.css";
import { CardImage } from "../../../src/components/cards/CardImage";
import { PageTransition } from "../../../src/components/PageTransition";
import { AnimatedRoutes } from "../../../src/components/routeTransition/AnimatedRoutes";

const ROWS = 8;
const CARDS = 20;

/** Une affiche distincte par carte : un SVG en ligne (chargement réel, adresse unique). */
function poster(row: number, card: number): string {
  const hue = (row * 47 + card * 13) % 360;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450">` +
    `<rect width="300" height="450" fill="hsl(${hue} 60% 35%)"/>` +
    `<text x="150" y="235" font-size="64" text-anchor="middle" fill="white">${row}-${card}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

let navigate: NavigateFunction = () => undefined;
function NavigateProbe() {
  const go = useNavigate();
  useEffect(() => {
    navigate = go;
  }, [go]);
  return null;
}

/** Le rendu de la coquille, du premier appel de son composant à son commit (ms). */
const mount = { renderStart: 0, lastMs: 0 };

function Shell() {
  if (mount.renderStart === 0) mount.renderStart = performance.now();
  useLayoutEffect(() => {
    mount.lastMs = performance.now() - mount.renderStart;
    mount.renderStart = 0;
  }, []);
  return (
    <div data-shell>
      <div className="bar" />
      <PageTransition>
        {Array.from({ length: ROWS }, (_, row) => (
          <div className="row" key={row}>
            {Array.from({ length: CARDS }, (_, card) => (
              <div className="card" data-card key={card}>
                <CardImage src={poster(row, card)} alt="" />
              </div>
            ))}
          </div>
        ))}
      </PageTransition>
    </div>
  );
}

function Fiche() {
  return <PageTransition className="fiche"><div data-fiche>Fiche</div></PageTransition>;
}

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
async function until(test: () => boolean, timeoutMs = 10_000): Promise<void> {
  const start = performance.now();
  while (!test()) {
    if (performance.now() - start > timeoutMs) throw new Error("attente dépassée");
    await nextFrame();
  }
}

/** Les cartes à l'écran dont l'affiche n'est pas peinte, pleine. */
function holes(): number {
  let count = 0;
  for (const card of document.querySelectorAll<HTMLElement>("[data-card]")) {
    const box = card.getBoundingClientRect();
    if (box.bottom <= 0 || box.top >= innerHeight || box.right <= 0 || box.left >= innerWidth) continue;
    const img = card.querySelector("img");
    if (!img || !img.complete || getComputedStyle(img).opacity !== "1") count += 1;
  }
  return count;
}

/** L'opacité de la page sous la barre (l'enveloppe de `PageTransition`). */
function pageOpacity(): number {
  const page = document.querySelector("[data-shell] .bar")?.nextElementSibling;
  return page ? Number(getComputedStyle(page).opacity) : 1;
}

const visibleCards = (): number =>
  [...document.querySelectorAll<HTMLElement>("[data-card]")].filter((card) => {
    const box = card.getBoundingClientRect();
    return box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
  }).length;

async function run() {
  // Première visite : les affiches à l'écran se chargent (et sont retenues « vues »).
  await until(() => document.querySelector("[data-shell]") !== null && holes() === 0);
  const shell = document.querySelector("[data-shell]");
  const shellNodes = shell ? shell.querySelectorAll("*").length + 1 : 0;
  const cardsOnScreen = visibleCards();

  const firstMountMs = mount.lastMs;

  // Ouvrir la fiche : la coquille sort (fondu), puis est démontée.
  const openAt = performance.now();
  navigate("/media/x");
  await until(() => document.querySelector("[data-shell]") === null);
  const shellGoneMs = performance.now() - openAt;
  for (let i = 0; i < 10; i += 1) await nextFrame();

  // Retour : la coquille se remonte. `until` rend la main DANS une image
  // (rAF), juste après le commit : `holes()` y lit ce que l'écran va peindre.
  const backAt = performance.now();
  navigate("/");
  await until(() => document.querySelector("[data-shell]") !== null);
  const shellBackMs = performance.now() - backAt;
  const frames: number[] = [holes()];
  // L'entrée de la page revenue (`PageTransition`) : tant qu'elle n'est pas
  // pleine, tout l'accueil est rejoué en fondu — même ses images déjà vues.
  let entranceMs = pageOpacity() >= 1 ? 0 : -1;
  for (let i = 0; i < 90; i += 1) {
    await nextFrame();
    if (i < 30) frames.push(holes());
    if (entranceMs < 0 && pageOpacity() >= 1) entranceMs = performance.now() - backAt - shellBackMs;
  }
  const firstFullFrame = frames.findIndex((count) => count === 0);
  return {
    rows: ROWS, cards: ROWS * CARDS, cardsOnScreen, shellNodes,
    firstMountMs: Math.round(firstMountMs * 10) / 10,
    remountMs: Math.round(mount.lastMs * 10) / 10,
    shellGoneMs: Math.round(shellGoneMs),
    shellBackMs: Math.round(shellBackMs),
    entranceMs: Math.round(entranceMs),
    framesWithHoles: frames.filter((count) => count > 0).length,
    maxHoles: Math.max(...frames),
    firstFullFrame,
    holesPerFrame: frames.slice(0, 8),
  };
}

declare global {
  interface Window {
    __bench: { run: typeof run };
  }
}
window.__bench = { run };

createRoot(document.getElementById("root") as HTMLElement).render(
  <MemoryRouter>
    <NavigateProbe />
    <AnimatedRoutes>
      <Route path="/" element={<Shell />} />
      <Route path="/media/:itemId" element={<Fiche />} />
    </AnimatedRoutes>
  </MemoryRouter>,
);
