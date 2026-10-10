import { useEffect, type MutableRefObject } from "react";
import { invoke } from "../desktop/bridge";
import type { PipMode } from "./pictureInPictureStore";
import { parsePipFrame, pipVideoSize, type PipFrame, type PipSize } from "./pipGeometry";

/**
 * La fenêtre PiP, ouverte par la page elle-même.
 *
 * La coquille la FABRIQUE (transparente, sans cadre, hors barre des tâches,
 * sous le titre que lit la colle KWin — `pip/pipWindow.ts`) ; la page l'ouvre
 * par `window.open` et y rend les contrôles du lecteur par un portail React :
 * même contexte JavaScript, mêmes traductions, les gestes du lecteur appelés
 * directement. La fenêtre est même origine que l'application (`about:blank`
 * hérite de celle de qui l'ouvre) : on y recopie les feuilles de style et le
 * thème, rien d'autre.
 *
 * Ouverte une fois par session PiP — un changement de mode passe par
 * `pip_mode` (le titre, que la colle suit), jamais par une réouverture. La
 * coquille rend à l'ouverture le cadre qu'elle a posé autour de la vidéo
 * (`pip_open`) ; la taille suit ensuite la fenêtre — un coin tiré, la molette.
 */

/** Le nom que la coquille attend — `PIP_FRAME_NAME`, `pip/pipWindow.ts`. */
const PIP_FRAME_NAME = "tentacle-pip";

/** Un Alt+F4 sur le PiP ne prévient personne : on regarde. */
const CLOSED_POLL_MS = 500;

interface PipWindowProps {
  mode: PipMode;
  /** La taille de la VIDÉO : la coquille y ajoute le cadre. */
  size: PipSize;
  /** Le conteneur du portail et le cadre à y dessiner, puis `null` à la fermeture. */
  onContainer: (container: HTMLElement | null, frame: PipFrame) => void;
  /** La vidéo a changé de taille — un coin tiré, la molette. */
  onResized: (size: PipSize) => void;
  /** La fenêtre a disparu sans nous (fermée par le bureau) — ou n'a pas pu naître. */
  onLost: () => void;
  /**
   * La fenêtre est À L'ÉCRAN — la vidéo y est déjà passée (la coquille la
   * déplace avant de la montrer) : la page peut quitter le lecteur.
   */
  onShown: () => void;
  windowRef: MutableRefObject<Window | null>;
}

/** La page de la fenêtre : styles et thème de l'application, fond transparent. */
function prepareDocument(child: Window): HTMLElement {
  const doc = child.document;
  const theme = document.documentElement.getAttribute("data-theme");
  if (theme !== null) doc.documentElement.setAttribute("data-theme", theme);
  doc.documentElement.lang = document.documentElement.lang;
  doc.documentElement.style.colorScheme = document.documentElement.style.colorScheme;
  for (const node of document.querySelectorAll<HTMLElement>('link[rel="stylesheet"], style')) {
    const copy = node.cloneNode(true) as HTMLElement;
    // L'adresse absolue : une page about:blank n'a pas toujours la base de qui l'ouvre.
    if (copy instanceof HTMLLinkElement && node instanceof HTMLLinkElement) copy.href = node.href;
    doc.head.appendChild(copy);
  }
  // APRÈS les feuilles de l'application : son fond de page ne doit pas masquer mpv.
  const base = doc.createElement("style");
  base.textContent =
    "html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent!important}";
  doc.head.appendChild(base);
  const root = doc.createElement("div");
  root.style.cssText = "position:fixed;inset:0";
  doc.body.appendChild(root);
  return root;
}

/** Appelle `shown` une fois, quand le document de la fenêtre devient visible. */
function whenVisible(child: Window, shown: () => void): () => void {
  const doc = child.document;
  const check = () => {
    if (doc.visibilityState !== "visible") return;
    doc.removeEventListener("visibilitychange", check);
    shown();
  };
  doc.addEventListener("visibilitychange", check);
  check();
  return () => doc.removeEventListener("visibilitychange", check);
}

export function PipWindow({ mode, size, onContainer, onResized, onLost, onShown, windowRef }: PipWindowProps) {
  useEffect(() => {
    let disposed = false;
    let child: Window | null = null;
    let poll: number | undefined;
    let unwatch: (() => void) | undefined;
    void (async () => {
      let frame: PipFrame;
      try {
        frame = parsePipFrame(await invoke<unknown>("pip_open", { mode, width: size.width, height: size.height }));
      } catch {
        if (!disposed) onLost();
        return;
      }
      if (disposed) return;
      const inset = 2 * (frame.shadow + frame.bezel);
      child = window.open(
        "about:blank", PIP_FRAME_NAME,
        `width=${String(size.width + inset)},height=${String(size.height + inset)}`,
      );
      if (child === null) {
        onLost();
        return;
      }
      const opened = child;
      windowRef.current = opened;
      opened.addEventListener("resize", () => {
        onResized(pipVideoSize(opened.innerWidth, opened.innerHeight, frame));
      });
      onContainer(prepareDocument(opened), frame);
      unwatch = whenVisible(opened, onShown);
      poll = window.setInterval(() => {
        if (child?.closed !== true || disposed) return;
        disposed = true;
        window.clearInterval(poll);
        onLost();
      }, CLOSED_POLL_MS);
    })();
    return () => {
      disposed = true;
      window.clearInterval(poll);
      unwatch?.();
      onContainer(null, { shadow: 0, bezel: 0 });
      windowRef.current = null;
      child?.close();
    };
    // Une fenêtre par session : le mode et la taille changent par la coquille.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
