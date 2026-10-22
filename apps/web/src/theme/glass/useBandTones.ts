/**
 * `useBandTones(element, enabled)` — un ton PAR RANGÉE sous un matériau épais
 * (menu, feuille), et le voile minimal là où un dessous moyen l'exige
 * (`bandTones.ts`). Chaque bande (`collectBands`) est mesurée par le même
 * ordonnanceur que les surfaces (`useBackdropTone`) — un appel regroupé,
 * jamais à chaque image — et reçoit `data-lg-band` = `dark` | `light` ; la
 * surface reçoit `data-lg-veil` et `--lg-band-veil` (un dégradé) s'il en faut.
 *
 * Tout est posé sur le DOM, sans rendu React : une rangée qui change de ton ne
 * refait que sa couleur (`liquidGlassSurface.css`). Une bande pas encore
 * mesurée garde le ton de la surface. Hors du mode natif, ou sans
 * échantillonneur : rien.
 */

import { useEffect } from "react";

import { bandLook, bandVeilGradient, collectBands, visibleBandRect, type BandLook, type BandWalk } from "./bandTones";
import { sharedScheduler } from "./useBackdropTone";

const BAND_ATTRIBUTE = "data-lg-band";
const VEIL_ATTRIBUTE = "data-lg-veil";
const VEIL_PROPERTY = "--lg-band-veil";
/** Contenu changé (rangées ajoutées, texte) : on relit les bandes, regroupé. */
const RESYNC_MS = 120;
/**
 * Relectures après l'ouverture : la première mesure tombe pendant l'entrée
 * animée du panneau (opacité) ; sans elles, le voile juste attendrait la
 * relecture lente (2 s). Deux captures de plus par ouverture, rien ensuite.
 */
const SETTLE_FOLLOW_UPS_MS = [300, 900] as const;

const DOM_WALK: BandWalk<Element> = {
  children: (node) => Array.from(node.children),
  height: (node) => node.getBoundingClientRect().height,
  hasOwnText: (node) =>
    Array.from(node.childNodes).some((c) => c.nodeType === Node.TEXT_NODE && (c.textContent ?? "").trim() !== ""),
  // Un verre imbriqué (`.lg-surface`, un contrôle à ton propre), un calque
  // décoratif (le reflet, le filtre de la lentille).
  skip: (node) =>
    node.getAttribute("aria-hidden") === "true" ||
    node.hasAttribute("data-lg-tone") ||
    node.classList.contains("lg-surface"),
};

let surfaces = 0;

export function useBandTones(element: HTMLElement | null, enabled: boolean): void {
  useEffect(() => {
    const scheduler = enabled && element !== null ? sharedScheduler() : null;
    if (scheduler === null || element === null) return undefined;
    const prefix = `band:${(surfaces += 1)}:`;
    const watched = new Map<Element, string>();
    const looks = new Map<Element, BandLook>();
    let next = 0;

    // Le dégradé du voile, une fois par lot de mesures, réécrit seulement s'il
    // change (une rangée défilée dans le menu déplace ses arrêts).
    let veilQueued = false;
    let disposed = false;
    let painted: string | null = null;
    const paintVeil = (): void => {
      veilQueued = false;
      if (disposed) return;
      const top = element.getBoundingClientRect().top;
      const bands = [...looks].map(([band, look]) => {
        const r = band.getBoundingClientRect();
        return { top: r.top - top, bottom: r.bottom - top, look };
      });
      const gradient = bandVeilGradient(bands);
      if (gradient === painted) return;
      painted = gradient;
      if (gradient === null) {
        element.style.removeProperty(VEIL_PROPERTY);
        element.removeAttribute(VEIL_ATTRIBUTE);
      } else {
        element.style.setProperty(VEIL_PROPERTY, gradient);
        element.setAttribute(VEIL_ATTRIBUTE, "");
      }
    };
    const queueVeil = (): void => {
      if (veilQueued) return;
      veilQueued = true;
      queueMicrotask(paintVeil);
    };

    // Chaque bande est mesurée en deux MOITIÉS (`bandLook` : le voile vaut
    // pour la plus exigeante) ; les deux arrivent dans le même lot, on décide
    // une fois qu'elles sont lues.
    const segments = new Map<Element, [number | null, number | null]>();
    const pending = new Set<Element>();
    const decide = (): void => {
      if (disposed) return;
      const surfaceTone = element.getAttribute("data-lg-tone") === "light" ? "light" : "dark";
      for (const band of pending) {
        const values = (segments.get(band) ?? [null, null]).filter((v): v is number => v !== null);
        if (values.length === 0 || !watched.has(band)) continue;
        const previous = looks.get(band) ?? null;
        const look = bandLook(previous, values, surfaceTone);
        if (look === previous) continue;
        looks.set(band, look);
        if (previous?.tone !== look.tone) band.setAttribute(BAND_ATTRIBUTE, look.tone);
      }
      pending.clear();
      paintVeil();
    };
    const measured = (band: Element, half: 0 | 1, luminance: number): void => {
      const pair = segments.get(band) ?? [null, null];
      pair[half] = luminance;
      segments.set(band, pair);
      if (pending.size === 0) queueMicrotask(decide);
      pending.add(band);
    };
    const halfOf = (band: Element, half: 0 | 1) => () => {
      const r = visibleBandRect(band.getBoundingClientRect(), element.getBoundingClientRect(), { width: innerWidth, height: innerHeight });
      if (r === null) return null;
      const width = r.width / 2;
      return { x: r.x + half * width, y: r.y, width, height: r.height };
    };

    const forget = (band: Element): void => {
      const id = watched.get(band);
      if (id !== undefined) {
        scheduler.unwatch(`${id}:0`);
        scheduler.unwatch(`${id}:1`);
      }
      band.removeAttribute(BAND_ATTRIBUTE);
      watched.delete(band);
      looks.delete(band);
      segments.delete(band);
    };

    const sync = (): void => {
      const bands = new Set(collectBands<Element>(element, DOM_WALK));
      for (const band of [...watched.keys()]) if (!bands.has(band)) forget(band);
      for (const band of bands) {
        if (watched.has(band)) continue;
        const id = prefix + String((next += 1));
        watched.set(band, id);
        scheduler.observe(`${id}:0`, halfOf(band, 0), (l) => measured(band, 0, l));
        scheduler.observe(`${id}:1`, halfOf(band, 1), (l) => measured(band, 1, l));
      }
      queueVeil();
    };
    sync();

    let resync: number | undefined;
    const mutations = new MutationObserver(() => {
      if (resync !== undefined) return;
      resync = window.setTimeout(() => {
        resync = undefined;
        sync();
        scheduler.request();
      }, RESYNC_MS);
    });
    mutations.observe(element, { childList: true, subtree: true, characterData: true });
    const resize = new ResizeObserver(() => scheduler.request());
    resize.observe(element);
    const followUps = SETTLE_FOLLOW_UPS_MS.map((ms) => window.setTimeout(() => scheduler.request(), ms));

    return () => {
      disposed = true;
      followUps.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(resync);
      mutations.disconnect();
      resize.disconnect();
      for (const band of [...watched.keys()]) forget(band);
      element.style.removeProperty(VEIL_PROPERTY);
      element.removeAttribute(VEIL_ATTRIBUTE);
    };
  }, [element, enabled]);
}
