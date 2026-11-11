import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PresenceContext, usePresence, useReducedMotion } from "framer-motion";
import { duration } from "../../theme/motion";
import { PageArrivalGateContext, PageRevealedContext, type PageArrivalGate } from "./pageArrival";
import { usePagePresence } from "./pagePresence";
import { beginRouteHold } from "./routeHold";
import { TransitionLevelContext, type PageArrival } from "./transitionLevel";
import { usePageSettled } from "./usePageSettled";
import { PAGE_HOLD_DATA_MS, PAGE_HOLD_IMAGES_MS } from "./pageSettled";
import { CarriedScrollEdge } from "../../desktop/ScrollEdgeEffect";

/** Propriétés posées le temps de la sortie, retirées si la page revient. */
const PINNED = ["position", "top", "left", "width", "pointer-events", "z-index", "opacity", "transition"] as const;

/** Au-dessus du contenu d'une page (ses `z-10` à `z-30`), sous la barre (`z-40`). */
export const SECTION_EXIT_LAYER = 35;
/**
 * Au-dessus de la coquille entière, barre et onglets compris ; sous les calques de `body`. Le
 * vol de l'affiche vers la fiche se tient juste dessous (`DetailOpenOverlay`).
 */
export const ROUTE_EXIT_LAYER = 55;

/** Le fondu de sortie, sur le compositeur ; la minuterie le double (un onglet caché n'envoie pas `transitionend`). */
const EXIT_MS = duration.pageOut * 1000;
/** Rien ne retient une page quittée au-delà : ni une porte jamais ouverte, ni une requête sans fin. */
const HOLD_GUARD_MS = PAGE_HOLD_DATA_MS + PAGE_HOLD_IMAGES_MS + 200;
/** Une apparition (fondu d'image, entrée de texte) ne dure pas plus ; au-delà c'est une boucle ou un voyage. */
const ENTRANCE_MAX_MS = 700;

const HELD: CSSProperties = { visibility: "hidden" };
/**
 * La plaque de la page quittée : l'encre de la page, sur tout l'écran. Sous le verre aussi — le
 * document y porte la même encre (`theme/paneShell.css`), seule la coquille s'efface devant le
 * fond ambiant. Sans plaque, la page d'arrivée se lisait À TRAVERS celle qu'on quitte pendant le
 * fondu : deux pages l'une sur l'autre (vu au banc, verre allumé, lot « rf2 »).
 */
const PLATE: CSSProperties = { position: "fixed", inset: 0, zIndex: -1, backgroundColor: "var(--surface-0)" };

/**
 * Amène à leur terme les apparitions en cours sous `root` — les fondus d'image déclenchés par un
 * chargement survenu pendant que la page se préparait cachée. Elle se montre POSÉE.
 */
function finishEntrances(root: HTMLElement): void {
  if (typeof root.getAnimations !== "function") return;
  for (const animation of root.getAnimations({ subtree: true })) {
    const end = Number(animation.effect?.getComputedTiming().endTime);
    if (!Number.isFinite(end) || end > ENTRANCE_MAX_MS) continue;
    try {
      animation.finish();
    } catch {
      /* une animation sans fin n'est pas une apparition */
    }
  }
}

interface RouteExitProps {
  children: ReactNode;
  /** Sortie sèche et aucune tenue, quelle que soit la destination (le miroir). */
  instant?: boolean;
  /** Cette page REMPLACE une page affichée (lu au montage) : elle se prépare cachée, l'autre reste. */
  replaces?: boolean;
  /** Le calque où la page se tient pendant sa sortie (`SECTION_EXIT_LAYER`, `ROUTE_EXIT_LAYER`). */
  layer?: number;
  /**
   * Ce que la page a DERRIÈRE elle sans le porter dans son enveloppe (le fond ambiant de la
   * coquille, sous le verre) : repris sur la plaque, pour que la page épinglée garde le fond
   * qu'on lui voyait. Une page qui porte son propre fond (la coquille, la fiche) n'en passe pas.
   */
  backdrop?: ReactNode;
}

/**
 * Enveloppe d'une page sous `AnimatePresence`.
 *
 * **La page quittée reste à l'écran jusqu'à ce que l'arrivée soit prête** (`transitionLevel.ts`).
 * Elle est épinglée où on la voyait, AU-DESSUS de la suivante, sur une plaque de la couleur de
 * la page ; la suivante se monte dessous, cachée, charge ses données et ses images, puis se
 * montre d'un bloc : la page quittée s'efface alors par-dessus elle. Un seul calque s'anime, en
 * opacité, sur le compositeur — et ce qu'on voit n'est jamais plus sombre ni plus clair que les
 * deux pages : `α·quittée + (1 − α)·arrivée`. Deux fondus croisés sur le fond de page, eux,
 * passaient par le noir.
 *
 * **Épinglée** : en `position: fixed` à l'endroit exact où elle s'affichait. La page suivante
 * prend sa place dans le flux, et la remise en haut du défilement (`useScrollMemory`) ne fait
 * pas sauter la page quittée.
 *
 * `flow-root` : la marge négative des bannières (`-mt-[68px]`, qui glissent sous la barre) reste
 * DANS l'enveloppe. Laissée fuir à travers, elle cesserait de le faire une fois l'enveloppe
 * épinglée — un bloc fixe ne fusionne pas ses marges — et la page sauterait de 68 px.
 *
 * **Le contenu arrive posé.** Une page qui en remplace une autre ne joue pas ses entrées (la
 * présence que voit son contenu dit `initial: false`) : la transition de page EST son entrée.
 *
 * **La sortie n'attend que l'enveloppe.** Le contenu voit une présence à lui (`pagePresence`) :
 * rien de ce qu'il anime ne peut retenir la page quittée — ni, par elle, le lecteur.
 */
export function RouteExit({ children, instant = false, replaces = false, layer = SECTION_EXIT_LAYER, backdrop }: RouteExitProps) {
  const [isPresent, safeToRemove] = usePresence();
  const reduced = useReducedMotion() === true;
  const level = useContext(TransitionLevelContext);
  const ref = useRef<HTMLDivElement>(null);

  // Sans présence au-dessus (le client LG démonte ses pages sans différer), personne ne garde la
  // page quittée : se préparer cachée laisserait l'écran vide.
  const kept = useContext(PresenceContext) !== null;
  // Décidé au montage : la page se prépare-t-elle cachée pendant qu'une autre reste à l'écran ?
  const [holds] = useState(() => replaces && !instant && level !== null && kept);
  const [claim, setClaim] = useState<PageArrival | null>(null);
  const gate = useMemo<PageArrivalGate>(() => ({
    claim: () => ({ report: setClaim, release: () => setClaim(null) }),
  }), []);
  const settled = usePageSettled(ref, holds && claim === null);
  const ready = !holds || (claim ? claim.ready : settled);
  const cut = instant || reduced || claim?.instant === true;
  const [revealed, setRevealed] = useState(!holds);
  // Lu à l'instant où la page se met à sortir, pas suivi par l'effet de sortie.
  const shown = useRef(revealed);
  shown.current = revealed;
  // Les entrées du contenu restent coupées jusqu'à la fin du fondu de la page quittée.
  const [entrancesBlocked, setEntrancesBlocked] = useState(holds);
  const inside = usePagePresence(entrancesBlocked);
  // Le défilement de la fenêtre à l'instant où la page se met à sortir — lu au rendu, avant que
  // la fenêtre ne soit remise à celui de la page suivante : ce qui en dépendait sous la barre
  // (l'effet de bord du verre) reste avec la page épinglée.
  const [leftAt, setLeftAt] = useState<number | null>(null);
  if (!isPresent && leftAt === null) setLeftAt(typeof window === "undefined" ? 0 : window.scrollY);
  if (isPresent && leftAt !== null) setLeftAt(null);

  // La page en place dit où elle en est ; prête, elle se montre — dans la même image.
  useLayoutEffect(() => {
    if (!isPresent) return;
    level?.setArrival({ ready, instant: cut });
    if (ready && !revealed) {
      if (ref.current) finishEntrances(ref.current);
      setRevealed(true);
    }
  }, [isPresent, level, ready, cut, revealed]);

  // Plus aucune page ne sort (le garde-fou l'a emportée) : jamais une page cachée sur un écran vide.
  useEffect(() => {
    if (!isPresent || revealed || !level) return;
    let seen = level.leaving() > 0;
    return level.subscribe(() => {
      if (level.leaving() > 0) seen = true;
      else if (seen) setRevealed(true);
    });
  }, [isPresent, revealed, level]);

  useEffect(() => {
    if (!revealed || !entrancesBlocked) return;
    const timer = setTimeout(() => setEntrancesBlocked(false), EXIT_MS + 80);
    return () => clearTimeout(timer);
  }, [revealed, entrancesBlocked]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isPresent) {
      // Revenue avant la fin de sa sortie (aller-retour rapide) : au flux.
      PINNED.forEach((property) => el.style.removeProperty(property));
      return;
    }
    const { top, left, width } = el.getBoundingClientRect();
    el.style.setProperty("position", "fixed");
    el.style.setProperty("top", `${top}px`);
    el.style.setProperty("left", `${left}px`);
    el.style.setProperty("width", `${width}px`);
    el.style.setProperty("z-index", String(layer));
  }, [isPresent, layer]);

  // La sortie : elle attend l'arrivée, puis s'efface (ou part d'un coup).
  useEffect(() => {
    if (isPresent) return;
    const el = ref.current;
    // Remplacée avant de s'être montrée : il n'y a rien à faire sortir.
    if (!shown.current || !el) {
      safeToRemove?.();
      return;
    }
    const release = level?.enterLeaving();
    // Tant qu'elle attend, la navigation le dit (`RouteProgress`, si l'attente dure).
    const endHold = beginRouteHold();
    let started = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (): void => {
      release?.();
      safeToRemove?.();
    };
    const leave = (force = false): void => {
      if (started) return;
      const arrival = level?.arrival() ?? { ready: true, instant: false };
      if (!arrival.ready && !force) return;
      started = true;
      endHold();
      // Les gestes ne se coupent qu'ici : tenue, la page garde ses survols — la carte qu'on
      // vient de cliquer ne se dégonfle pas sous le curseur en attendant la suivante.
      el.style.setProperty("pointer-events", "none");
      if (arrival.instant || reduced) return finish();
      el.style.setProperty("transition", `opacity ${EXIT_MS}ms var(--ease-out)`);
      el.style.setProperty("opacity", "0");
      timer = setTimeout(finish, EXIT_MS + 40);
    };
    const unsubscribe = level?.subscribe(() => leave());
    const guard = setTimeout(() => leave(true), HOLD_GUARD_MS);
    leave();
    return () => {
      unsubscribe?.();
      clearTimeout(guard);
      clearTimeout(timer);
      endHold();
      release?.();
    };
  }, [isPresent, level, reduced, safeToRemove]);

  return (
    <div ref={ref} className="flow-root" style={revealed ? undefined : HELD} data-page-held={!revealed || undefined}>
      {/* La plaque : la page quittée couvre tout l'écran, barre comprise, du fond qu'on lui voyait. */}
      {!isPresent && revealed && <div aria-hidden style={PLATE}>{backdrop}</div>}
      {!isPresent && revealed && leftAt !== null && <CarriedScrollEdge scrollY={leftAt} />}
      <PageArrivalGateContext.Provider value={gate}>
        <PageRevealedContext.Provider value={revealed}>
          <PresenceContext.Provider value={inside}>{children}</PresenceContext.Provider>
        </PageRevealedContext.Provider>
      </PageArrivalGateContext.Provider>
    </div>
  );
}
