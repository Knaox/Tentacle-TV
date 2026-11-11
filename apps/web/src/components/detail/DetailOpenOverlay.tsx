import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { OPENING_LANDED_GUARD_MS, openingStep, type DetailOrigin } from "./detailTransition";
import { DetailFlight } from "./DetailFlight";
import { ROUTE_EXIT_LAYER } from "../routeTransition/RouteExit";

export interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface DetailOpenOverlayProps {
  origin: DetailOrigin | null;
  /** Place finale du visuel, mesurée par `DetailPoster` (la fiche se prépare cachée : elle est déjà en page). */
  target: TargetRect | null;
  /** La fiche est MONTRÉE : la page quittée s'efface par-dessus elle (`usePageRevealed`). */
  revealed: boolean;
  /** Le visuel est posé : l'affiche de la fiche, cachée pendant le vol, se montre dessous. */
  onLanded?: () => void;
  onDone: () => void;
}

/**
 * Course du visuel — CALÉE SUR L'ATTENTE RÉELLE.
 *
 * Quand la fiche est déjà en cache, il n'y a aucun délai à couvrir : le mouvement n'est que de
 * la cérémonie, et de la cérémonie à chaque clic finit par se ressentir comme de la lenteur.
 * Quand la requête a traîné, il peut respirer. La course part donc du minimum et n'emprunte
 * qu'une FRACTION de l'attente mesurée, plafonnée : rien d'interface ne dépasse 320 ms
 * (docs/REFONTE-UI.md).
 */
const TRAVEL_MIN_S = 0.24;
const TRAVEL_MAX_S = 0.32;
/** Part de l'attente reportée sur la course. */
const TRAVEL_WAIT_RATIO = 0.4;

type Phase = "waiting" | "flying" | "landed";

/**
 * Le vol se tient JUSTE SOUS la page quittée, au-dessus de la fiche. À la première image, la
 * page quittée est encore pleine : on voit exactement ce qu'on voyait — la carte, son survol,
 * ses marqueurs. Elle s'efface ensuite d'un bloc (120 ms) et découvre l'affiche déjà en route.
 *
 * Posé AU-DESSUS d'elle, le visuel nu recouvrait d'un coup l'habillage de survol de la carte
 * qu'on vient de cliquer, et il fallait cacher la carte dessous (un trou dans la page qui sort) ;
 * parti sur l'horloge de framer, il avait en plus une image d'avance sur le fondu quand le rendu
 * de la fiche était long (banc `bench:page-flicker` : une image « en recul » par ouverture).
 */
const FLIGHT_LAYER = ROUTE_EXIT_LAYER - 1;

/**
 * Ouverture de la fiche média — transition d'élément partagé.
 *
 * **La fiche fond, l'affiche vole** (lot « rf2 », nov. 2026). La page d'où l'on vient reste à
 * l'écran pendant que la fiche charge son titre et décode ses images, cachée dessous
 * (`routeTransition/RouteExit`) ; puis elle s'efface par-dessus la fiche COMPLÈTE, et dans la
 * même image le visuel de la carte décolle jusqu'à la place exacte de l'affiche. Un seul fondu,
 * un seul objet qui bouge.
 *
 * Avant, ce calque couvrait l'écran d'une base opaque et y rejouait le décor et les voiles de
 * la scène : l'écran passait par plus sombre que les deux pages, puis par plus clair que la
 * fiche (décor à nu), puis retombait quand le texte et son assise paraissaient — le
 * scintillement relevé par Damien (banc `bench:page-flicker` : 20 à 30 images parasites par
 * ouverture). Et tant que la requête n'était pas revenue, il n'avait que du noir à montrer.
 *
 * Rien n'est monté avant le départ, et la carte cliquée n'est jamais touchée : elle garde ses
 * marqueurs et son survol le temps de l'attente, puis part avec sa page. Sans cible (un titre
 * sans affiche), rien ne vole. Animations réduites : rien.
 */
export function DetailOpenOverlay({ origin, target, revealed, onLanded, onDone }: DetailOpenOverlayProps) {
  const reduced = useReducedMotion() === true;
  const [phase, setPhase] = useState<Phase>("waiting");
  /** Instant de la prise en charge, pour mesurer l'attente réelle (une fiche = un calque). */
  const [startedAt] = useState(() => performance.now());
  /** Cible et course figées au départ : elles ne bougent plus en plein vol. */
  const flight = useRef<{ to: TargetRect; travelS: number } | null>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const landed = useRef(onLanded);
  landed.current = onLanded;

  // La fiche se montre : le visuel part avec elle — ou, sans rien à viser, il n'y a rien à jouer.
  const step = origin && phase === "waiting" ? openingStep({ revealed, hasTarget: target !== null, reduced }) : "wait";
  // En effet de MISE EN PAGE : le visuel décolle dans l'image même où la fiche se montre et où
  // la page quittée commence à s'effacer — pas une image plus tard.
  useLayoutEffect(() => {
    if (step === "skip") done.current();
    if (step !== "fly" || !target) return;
    const waitedS = (performance.now() - startedAt) / 1000;
    flight.current = { to: target, travelS: Math.min(TRAVEL_MAX_S, TRAVEL_MIN_S + waitedS * TRAVEL_WAIT_RATIO) };
    setPhase("flying");
  }, [step, target, startedAt]);

  // Le calque ne garde JAMAIS le visuel en l'air : posé ou non, il se retire.
  useEffect(() => {
    if (phase !== "flying") return;
    const guard = setTimeout(() => {
      landed.current?.();
      setPhase("landed");
    }, OPENING_LANDED_GUARD_MS);
    return () => clearTimeout(guard);
  }, [phase]);

  if (!origin || reduced) return null;
  const going = flight.current;

  return createPortal(
    <AnimatePresence onExitComplete={() => done.current()}>
      {phase === "flying" && going && (
        <div key={origin.stamp} className="pointer-events-none fixed inset-0" style={{ zIndex: FLIGHT_LAYER }} aria-hidden>
          <DetailFlight
            from={origin.rect}
            to={going.to}
            radius={origin.radius}
            imageUrl={origin.imageUrl}
            travelS={going.travelS}
            onLanded={() => {
              landed.current?.();
              setPhase("landed");
            }}
          />
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
