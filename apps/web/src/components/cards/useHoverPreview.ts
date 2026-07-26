import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { boundsFor, canPlacePanel, visualRect } from "./cardAnchor";
import type { AnchorRect, PreviewBounds } from "./hoverPreviewGeometry";
import { pointerStillOn } from "../../hooks/useHoverGuard";

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
  /**
   * La dernière fermeture était-elle SÈCHE — sans sortie animée ?
   *
   * La sortie du panneau (140 ms de fondu qui le repose sur sa carte) suppose un
   * curseur qui s'en va : elle rend la main à la carte, dessous, au même
   * endroit. Quand c'est un DÉFILEMENT qui invalide le survol, cette hypothèse
   * tombe. Le panneau exposant ses coordonnées de fenêtre à l'ouverture, framer
   * le fait sortir avec les props de son dernier rendu : il reste donc CLOUÉ à
   * l'écran pendant que la page glisse dessous, et on voit un panneau à
   * mi-opacité suspendu au-dessus d'un contenu qui n'est plus le sien. C'est le
   * survol fantôme. Personne n'ayant bougé le curseur, il n'y a pas d'adieu à
   * faire : le panneau disparaît net.
   */
  cut: boolean;
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

  /**
   * Sortie animée ou fermeture sèche (cf. `cut`). Un ref et non un état : la
   * valeur est POSÉE avant le `setAnchor(null)` qui provoque le rendu où elle
   * est lue, donc elle y est déjà juste — et un état de plus ferait un rendu de
   * plus sur le chemin le plus fréquent de l'app.
   */
  const dryRef = useRef(false);

  const close = useCallback(() => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    if (activeCloser === close) activeCloser = null;
    setAnchor(null);
  }, []);

  /** Fermeture sans sortie animée — le survol n'a pas été quitté, il a été invalidé. */
  const closeDry = useCallback(() => {
    dryRef.current = true;
    close();
  }, [close]);

  const scheduleOpen = useCallback(() => {
    pointerInside.current = true;
    // Toute ouverture repart d'une sortie animée : seule une invalidation
    // géométrique la rend sèche.
    dryRef.current = false;
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
      // Re-vérifié à l'échéance : la rangée a pu défiler entre-temps — et
      // `pointerStillOn` parce qu'elle a pu défiler SOUS un curseur immobile,
      // auquel cas aucun `mouseleave` n'est venu annuler cette ouverture. Un
      // panneau qui s'ouvre 110 ms plus tard sur une carte que le curseur a
      // quittée, c'est le fantôme dans sa version la plus visible.
      if (!el || !canPlacePanel(el) || !pointerStillOn(el)) return;
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
        // `pointerInside` dit où le curseur ÉTAIT au dernier événement souris, et
        // il n'y en a pas quand la page défile sous une main immobile : c'est la
        // géométrie qui tranche alors (cf. `useHoverGuard`). Fermeture SÈCHE —
        // on est en plein défilement, une sortie animée resterait clouée à
        // l'écran (cf. `cut`).
        if (!el || !pointerInside.current || !canPlacePanel(el) || !pointerStillOn(el)) { closeDry(); return; }
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

    /**
     * Toute interaction AILLEURS referme l'aperçu.
     *
     * Ouvrir le menu profil, le panneau Watch Together, une boîte de dialogue —
     * n'importe quelle surface — laissait sinon l'aperçu ouvert derrière elle :
     * périmé, et suspendu à un curseur qui est déjà parti ailleurs. Le remettre
     * simplement sous ces surfaces dans l'ordre d'empilement ne suffit pas ; il
     * n'a plus rien à faire à l'écran.
     *
     * Écouté en phase de CAPTURE sur `pointerdown`, donc avant que la surface
     * visée ne s'ouvre et avant tout `click`. Et surtout : aucune de ces
     * surfaces n'a à connaître l'existence de l'aperçu. C'est lui qui se retire,
     * ce qui vaut aussi pour celles qui n'existent pas encore.
     */
    const onPointerDown = (e: PointerEvent) => {
      const node = e.target;
      const el = node instanceof Element ? node : null;
      if (!el) return;
      // Sur la carte elle-même : c'est un clic de navigation, la carte s'en
      // charge. Dans le panneau : ce sont ses propres actions.
      if (anchorRef.current?.contains(el) || el.closest("[data-preview-panel]")) return;
      close();
    };

    window.addEventListener("scroll", reflow, true);
    window.addEventListener("resize", reflow);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", reflow, true);
      window.removeEventListener("resize", reflow);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, close, closeDry]);

  useEffect(() => { close(); }, [location.key, close]);
  useEffect(() => { if (disabled) close(); }, [disabled, close]);
  useEffect(() => close, [close]);

  return {
    anchorRef,
    eligible: eligible && !disabled,
    panelActive: eligible && !disabled && placeable,
    open: anchor !== null,
    cut: dryRef.current,
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
