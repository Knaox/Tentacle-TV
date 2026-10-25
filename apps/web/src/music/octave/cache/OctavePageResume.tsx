/**
 * Octave — la page en cours, gardée et rejouée : chaque changement de page et
 * chaque défilement (au repos) s'écrivent sur l'appareil, la sortie de page
 * aussi ; au premier montage, la page gardée retrouve son défilement — avant
 * la première image quand ses données sont déjà là (cache gardé), sinon dès
 * qu'elle est assez haute, jamais contre un geste de l'utilisateur.
 *
 * Monté APRÈS la coquille (`OctaveApp`) : ses effets passent après la remise
 * en haut de page d'une page nouvelle (`OctaveShell`).
 */

import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { OCTAVE_BASE_PATH } from "../mode/octaveMode";
import { octaveOwner } from "./octaveOwner";
import { markOctavePageReached, resumeScroll, savedOctavePageAtLaunch, writeSavedOctavePage } from "./pageResume";

const MAIN_ID = "octave-main";
/** Un défilement s'écrit une fois au repos. */
const SAVE_DELAY_MS = 300;
/** La page gardée a ce temps pour devenir assez haute (ses données arrivent du cache, puis du réseau). */
const RESTORE_WINDOW_MS = 3_000;
const USER_GESTURES = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

let restored = false;

/** Pour les tests. */
export function resetPageResumeForTests(): void {
  restored = false;
}

function main(): HTMLElement | null {
  return document.getElementById(MAIN_ID);
}

/**
 * Pose le défilement dès que la page est assez haute : un `ResizeObserver`
 * sur son contenu (appelé après la mise en page, AVANT la peinture de l'image
 * où le contenu arrive — aucun saut visible) ; une remise en haut par la
 * coquille (page neuve) est corrigée dans la même image (évènement `scroll`,
 * avant la peinture). Jamais contre un geste de l'utilisateur, au plus
 * `RESTORE_WINDOW_MS`. Rend l'arrêt.
 */
function restoreWhenTall(el: HTMLElement, wanted: number): () => void {
  let done = false;
  const place = () => {
    if (done || Math.abs(el.scrollTop - wanted) < 2 || el.scrollHeight - el.clientHeight < wanted - 1) return;
    el.scrollTop = wanted;
  };
  const resize = new ResizeObserver(place);
  const watch = () => {
    for (const child of Array.from(el.children)) resize.observe(child);
  };
  const children = new MutationObserver(watch);
  const timer = setTimeout(() => stop(), RESTORE_WINDOW_MS);
  function stop() {
    done = true;
    resize.disconnect();
    children.disconnect();
    clearTimeout(timer);
    el.removeEventListener("scroll", place);
    for (const type of USER_GESTURES) el.removeEventListener(type, stop);
  }
  for (const type of USER_GESTURES) el.addEventListener(type, stop, { passive: true });
  el.addEventListener("scroll", place, { passive: true });
  children.observe(el, { childList: true });
  watch();
  place();
  return stop;
}

export function OctavePageResume() {
  const location = useLocation();
  const path = `${location.pathname}${location.search}`;
  const pathRef = useRef(path);
  pathRef.current = path;
  const owner = useRef(octaveOwner());

  // Le défilement de la page gardée, une fois par chargement de l'application.
  const target = useRef<number | null>(null);
  if (!restored && target.current === null) {
    target.current = resumeScroll(savedOctavePageAtLaunch(), owner.current, Date.now(), OCTAVE_BASE_PATH, path);
  }
  useLayoutEffect(() => {
    markOctavePageReached();
    if (restored) return;
    restored = true;
    const wanted = target.current;
    const el = main();
    if (wanted === null || !el) return;
    return restoreWhenTall(el, wanted);
  }, []);

  // L'écriture : la page à chaque changement, le défilement au repos, la sortie de page.
  useEffect(() => {
    const save = () => {
      if (owner.current === null) return;
      writeSavedOctavePage({ owner: owner.current, path: pathRef.current, scrollTop: Math.round(main()?.scrollTop ?? 0), savedAt: Date.now() });
    };
    save();
    const el = main();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(save, SAVE_DELAY_MS);
    };
    el?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      if (timer !== null) clearTimeout(timer);
      el?.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [path]);

  return null;
}
