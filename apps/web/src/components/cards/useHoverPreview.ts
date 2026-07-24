import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { canAnchorPreview } from "./hoverPreviewGeometry";
import type { AnchorRect, PreviewBounds } from "./hoverPreviewGeometry";

/**
 * Bornes horizontales du panneau : la zone de CONTENU de la rangée, c'est-à-dire
 * son rectangle amputé de sa propre gouttière (`row-gutter`, lue en CSS donc
 * juste à tous les points de rupture — 16 px en mobile, 56 px au-delà).
 *
 * C'est la borne exacte, ni plus ni moins, et la mesure le montre : sur une
 * rangée de 1432 px, le disque de la flèche droite occupe 1380→1420, soit
 * entièrement dans les 56 px de gouttière, tandis que la première carte
 * commence pile à 56. Borner sur la gouttière garde donc les flèches
 * cliquables ET aligne le panneau sur sa carte.
 *
 * Deux réglages plus larges ont échoué avant celui-ci : la fenêtre entière
 * (le panneau débordait dans la gouttière, mal cadré) puis une réserve fixe de
 * 72 px (plus large que la gouttière, elle poussait le panneau de la première
 * carte vers la droite — le décalage visible à l'écran).
 */
function boundsFor(card: HTMLElement | null): PreviewBounds | undefined {
  const row = card?.closest<HTMLElement>(".row-dim");
  if (!row) return undefined;
  const r = row.getBoundingClientRect();
  const cs = getComputedStyle(row);
  return {
    left: r.left + (parseFloat(cs.paddingLeft) || 0),
    right: r.right - (parseFloat(cs.paddingRight) || 0),
  };
}

/**
 * Le panneau peut-il se poser SUR cette carte ?
 *
 * Toute la règle vit dans `canAnchorPreview` (géométrie pure, testable) : le
 * panneau bute contre les bornes de la rangée et n'est refusé que si l'écart
 * dépasse un quart de la carte. Deux refus historiques ont disparu :
 *  • la carte devait tenir ENTIÈREMENT dans la rangée — or la dernière carte
 *    visible d'un carrousel est presque toujours rognée par construction ;
 *  • le panneau ne devait pas remonter pour tenir à l'écran — il se déroule
 *    désormais vers le HAUT quand la carte est trop basse.
 */
function canPlacePanel(card: HTMLElement | null): boolean {
  if (!card) return false;
  const r = card.getBoundingClientRect();
  return canAnchorPreview(
    { top: r.top, left: r.left, width: r.width, height: r.height },
    { width: window.innerWidth, height: window.innerHeight },
    boundsFor(card),
  );
}

/**
 * Délai d'ouverture : assez long pour que traverser une rangée n'ouvre pas dix
 * panneaux d'affilée, assez court pour ne pas se ressentir comme une attente.
 *
 * Le réglage s'est joué entre deux écueils opposés. À 90 ms le panneau
 * surgissait sous le curseur, le survol devenait nerveux ; à 170 ms le délai
 * devenait perceptible et l'ouverture semblait traîner. 110 ms tient, MAIS à
 * une condition : que la carte réponde INSTANTANÉMENT au survol par ailleurs
 * (son liseré, cf. `suppressLift` dans CardFrame). Sans ce retour immédiat,
 * n'importe quelle valeur non nulle se lit comme de la latence.
 */
const OPEN_DELAY_MS = 110;
/** Sursis à la sortie : le temps que le curseur traverse vers le panneau. */
const CLOSE_GRACE_MS = 220;
/** En deçà, l'écran n'a pas la place d'un panneau agrandi. */
const MIN_VIEWPORT_WIDTH = 1024;

/**
 * Un seul panneau à la fois. Sans ce registre, passer vite d'une carte à sa
 * voisine laisserait l'ancien panneau visible pendant son sursis de fermeture,
 * en même temps que le nouveau s'ouvre.
 */
let activeCloser: (() => void) | null = null;

export interface HoverPreview {
  /** À poser sur la racine de la carte : sert d'ancre géométrique. */
  anchorRef: React.RefObject<HTMLDivElement | null>;
  /**
   * Le panneau peut s'ouvrir sur cet appareil. La carte s'en sert pour NE PAS
   * dupliquer ses actions en surimpression : le panneau les porte déjà, plus
   * grandes et mieux légendées. Au toucher (ou en économie de données), il n'y
   * a pas de panneau — les actions de carte restent alors le seul accès.
   */
  eligible: boolean;
  /**
   * Le panneau est utilisable POUR CETTE CARTE, ici et maintenant : appareil
   * compatible ET place suffisante. Évalué au survol, avant même l'ouverture,
   * pour que la carte sache immédiatement si elle doit sortir son propre
   * survol de remplacement — sans attendre 90 ms ni faire clignoter les deux.
   */
  panelActive: boolean;
  open: boolean;
  /** Position de la carte au moment de l'ouverture (null si fermé). */
  anchor: AnchorRect | null;
  /** Bornes de la rangée, figées avec l'ancre. */
  bounds: PreviewBounds | undefined;
  close: () => void;
  /** À étaler sur la racine de la carte. */
  handlers: { onMouseEnter: () => void; onMouseLeave: () => void };
  /** À étaler sur le panneau, pour qu'y entrer ne le ferme pas. */
  panelHandlers: { onMouseEnter: () => void; onMouseLeave: () => void };
}

/** Le panneau n'a de sens qu'à la souris et sur un grand écran. */
function useEligible(): boolean {
  const reduced = useReducedMotion();
  const [roomy, setRoomy] = useState(false);

  useEffect(() => {
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const check = () => setRoomy(pointer.matches && window.innerWidth >= MIN_VIEWPORT_WIDTH);
    check();
    window.addEventListener("resize", check);
    pointer.addEventListener("change", check);
    return () => {
      window.removeEventListener("resize", check);
      pointer.removeEventListener("change", check);
    };
  }, []);

  // Le mode économie NE désactive PAS l'aperçu, contrairement à une première
  // version. Le réglage par défaut est `auto` et suit le débit mesuré : sur une
  // liaison à ~1,7 Mb/s il s'active tout seul, et l'aperçu disparaissait alors
  // sans explication — présent un instant, absent le suivant, au gré de la
  // sonde réseau. Une fonctionnalité qui clignote au fil du débit est pire
  // qu'une fonctionnalité coûteuse. L'économie se fait désormais là où elle
  // doit : `HoverPreviewBody` réutilise l'image DÉJÀ chargée par la carte au
  // lieu d'en demander une nouvelle, soit zéro octet supplémentaire.
  return roomy && !reduced;
}

/**
 * Aperçu au survol prolongé d'une carte, rendu dans un portail (cf.
 * `CardHoverPreview`) : il déborde donc librement de la rangée, dont
 * l'`overflow-x` clipperait n'importe quel panneau resté dans le flux.
 *
 * `disabled` coupe l'ouverture quand un menu contextuel est déjà ouvert sur la
 * carte — deux surfaces flottantes concurrentes sur la même cible.
 */
export function useHoverPreview(disabled = false): HoverPreview {
  const eligible = useEligible();
  const location = useLocation();
  const anchorRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [bounds, setBounds] = useState<PreviewBounds | undefined>(undefined);
  const [placeable, setPlaceable] = useState(true);

  const close = useCallback(() => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    if (activeCloser === close) activeCloser = null;
    setAnchor(null);
  }, []);

  const scheduleOpen = useCallback(() => {
    if (!eligible || disabled) return;
    // Verdict IMMÉDIAT, dès l'entrée du curseur : la carte doit savoir sans
    // délai si elle prend le relais avec son propre survol.
    const ok = canPlacePanel(anchorRef.current);
    setPlaceable(ok);
    if (!ok) return;

    clearTimeout(closeTimer.current);
    clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => {
      const el = anchorRef.current;
      // Re-vérifié à l'échéance : la rangée a pu défiler entre-temps.
      if (!el || !canPlacePanel(el)) return;
      const r = el.getBoundingClientRect();
      if (activeCloser && activeCloser !== close) activeCloser();
      activeCloser = close;
      setBounds(boundsFor(el));
      setAnchor({ top: r.top, left: r.left, width: r.width, height: r.height });
    }, OPEN_DELAY_MS);
  }, [eligible, disabled, close]);

  const scheduleClose = useCallback(() => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(close, CLOSE_GRACE_MS);
  }, [close]);

  // Le panneau est ancré en coordonnées de fenêtre figées à l'ouverture :
  // au moindre défilement il se décrocherait de sa carte, donc on ferme.
  useEffect(() => {
    if (!anchor) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchor, close]);

  useEffect(() => { close(); }, [location.key, close]);
  useEffect(() => { if (disabled) close(); }, [disabled, close]);
  useEffect(() => close, [close]);

  return {
    anchorRef,
    eligible: eligible && !disabled,
    panelActive: eligible && !disabled && placeable,
    open: anchor !== null,
    anchor,
    bounds,
    close,
    handlers: { onMouseEnter: scheduleOpen, onMouseLeave: scheduleClose },
    panelHandlers: { onMouseEnter: () => clearTimeout(closeTimer.current), onMouseLeave: scheduleClose },
  };
}
