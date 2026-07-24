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
 * Boîte que le panneau recouvre : le VISUEL de la carte, pas la carte entière.
 *
 * La racine porte aussi le bloc titre, une cinquantaine de pixels sous l'image.
 * Tant que le panneau se déroulait vers le bas, l'écart ne se voyait pas — il
 * s'aligne alors sur le HAUT, commun aux deux boîtes. Dès qu'il se déroule vers
 * le haut, c'est le BAS qui sert d'ancre, et la vignette du panneau atterrissait
 * une cinquantaine de pixels trop bas.
 */
function visualRect(card: HTMLElement): AnchorRect {
  const el = card.querySelector<HTMLElement>("[data-card-visual]") ?? card;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * Le panneau peut-il se poser SUR cette carte ? Oui, dès qu'elle a une largeur.
 *
 * Cette fonction ne refuse plus rien, et c'est le résultat de trois itérations.
 * Elle exigeait d'abord que la carte tienne entièrement dans la rangée, puis que
 * le décalage de butée reste sous un tiers de sa largeur — chaque règle privait
 * d'aperçu des cartes parfaitement survolables. La disposition superposée
 * (`overlay`) supprime la cause : un panneau qui ne quitte jamais sa carte n'a
 * besoin ni de place libre ni de tolérance.
 */
function canPlacePanel(card: HTMLElement | null): boolean {
  return card ? canAnchorPreview(visualRect(card)) : false;
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
  /**
   * Le curseur est-il TOUJOURS sur la carte ou sur le panneau ?
   *
   * Sert au suivi du défilement : tant que oui, le panneau suit sa carte ; dès
   * que non, il se referme. On ne peut pas s'en remettre à `:hover` — après un
   * défilement au clavier ou à la molette, l'état de survol du navigateur n'est
   * réévalué qu'au prochain mouvement de souris.
   */
  const pointerInside = useRef(false);

  const close = useCallback(() => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    if (activeCloser === close) activeCloser = null;
    setAnchor(null);
  }, []);

  const scheduleOpen = useCallback(() => {
    pointerInside.current = true;
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
      if (activeCloser && activeCloser !== close) activeCloser();
      activeCloser = close;
      setBounds(boundsFor(el));
      setAnchor(visualRect(el));
    }, OPEN_DELAY_MS);
  }, [eligible, disabled, close]);

  const scheduleClose = useCallback(() => {
    pointerInside.current = false;
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(close, CLOSE_GRACE_MS);
  }, [close]);

  /**
   * Suivi du défilement.
   *
   * Le panneau est ancré en coordonnées de FENÊTRE : sans rien faire, il se
   * décrocherait de sa carte au premier pixel de défilement. La version
   * précédente le refermait donc — mais dérouler la page en gardant la souris
   * sur une carte est exactement ce qu'on fait pour lire un aperçu, et
   * l'aperçu disparaissait sous le curseur.
   *
   * Il suit désormais sa carte tant que le curseur y reste, et se replace à
   * chaque image : le sens de déploiement est recalculé au passage, si bien
   * qu'un panneau ouvert vers le haut redescend de lui-même dès que la carte
   * remonte et libère la place. Il ne se referme que si le curseur est parti,
   * ou si la carte est sortie de la zone où le panneau peut se poser.
   */
  const open = anchor !== null;
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const reflow = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = anchorRef.current;
        if (!el || !pointerInside.current || !canPlacePanel(el)) { close(); return; }
        // Comparaison avant écriture : un défilement vertical ne change pas les
        // bornes de la rangée, et une frame sans changement ne doit pas coûter
        // un rendu du panneau.
        const next = visualRect(el);
        setAnchor((prev) =>
          prev && prev.top === next.top && prev.left === next.left
            && prev.width === next.width && prev.height === next.height
            ? prev
            : next,
        );
        const nextBounds = boundsFor(el);
        setBounds((prev) =>
          prev && nextBounds && prev.left === nextBounds.left && prev.right === nextBounds.right
            ? prev
            : nextBounds,
        );
      });
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("scroll", reflow, true);
    window.addEventListener("resize", reflow);
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", reflow, true);
      window.removeEventListener("resize", reflow);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

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
    panelHandlers: {
      onMouseEnter: () => { pointerInside.current = true; clearTimeout(closeTimer.current); },
      onMouseLeave: scheduleClose,
    },
  };
}
