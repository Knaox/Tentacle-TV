import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DETAIL_STAGE_BOX, DETAIL_STAGE_FOCUS, DETAIL_STAGE_LAYERS } from "./detailStageGeometry";
import { openingGuardDelay, type DetailOrigin } from "./detailTransition";
import { DetailStageFallback } from "./DetailArtworkFallback";
import { DetailFlight } from "./DetailFlight";

export interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface DetailOpenOverlayProps {
  origin: DetailOrigin | null;
  /** Backdrop de la fiche — décor qui s'ouvre derrière le visuel en vol. */
  backdropUrl: string | null;
  /** Place finale du visuel, mesurée par `DetailPoster`. */
  target: TargetRect | null;
  /**
   * La fiche est rendue (requête revenue). Sans cible mesurée dans la foulée
   * — titre sans affiche —, le calque s'efface sur place au lieu d'attendre.
   */
  settled?: boolean;
  /** Fiche prête (`useDetailArrival`) : le visuel posé, le calque l'attend pour s'effacer ; le garde-fou reste le plafond. */
  ready?: boolean;
  /** La base est opaque : la fiche peut se montrer dessous (`MediaDetail`). */
  onCovered?: () => void;
  onDone: () => void;
}

/**
 * Course du visuel — CALÉE SUR L'ATTENTE RÉELLE.
 *
 * Une transition d'ouverture sert à couvrir un délai. Quand la fiche est déjà en
 * cache, il n'y a aucun délai à couvrir : le mouvement n'est plus que de la
 * cérémonie, et 440 ms de cérémonie à chaque clic finissent par se ressentir
 * comme de la lenteur. Quand la requête traîne, en revanche, le mouvement a un
 * rôle — il occupe l'attente au lieu de la laisser vide — et il peut respirer.
 *
 * D'où une course qui part du minimum et n'emprunte qu'une FRACTION de
 * l'attente mesurée, plafonnée : une requête interminable ne doit pas produire
 * un vol interminable par-dessus, ce qui reviendrait à faire payer deux fois.
 *
 * Les couches de DÉCOR gardent, elles, des durées fixes : elles se jouent
 * pendant l'attente, avant que celle-ci ne soit connue.
 */
const TRAVEL_MIN_S = 0.24;
const TRAVEL_MAX_S = 0.5;
/** Part de l'attente reportée sur la course. */
const TRAVEL_WAIT_RATIO = 0.4;
/** Durée de référence des couches de décor (indépendante de l'attente). */
const DECOR_S = 0.44;
/** Décélération franche puis arrivée qui se pose, sans le moindre rebond. */
const SETTLE = [0.16, 1, 0.3, 1] as const;
/*
 * Sécurité : le calque ne garde JAMAIS l'écran (`openingGuardDelay`). Le
 * compte à rebours part de la première MESURE reçue — ou, sans mesure, de
 * l'arrivée de la fiche —, jamais du montage : sur une requête lente, un
 * garde-fou lancé au montage coupait le calque avant même que le vol ait
 * commencé.
 */

/**
 * Ouverture de la fiche média — transition d'élément partagé (FLIP).
 *
 * Le visuel de la carte cliquée ne « grossit » pas au hasard : il VOYAGE, de
 * son rectangle d'origine jusqu'à la place exacte qu'il occupera sur la fiche,
 * mesurée après mise en page (`DetailPoster.onMeasure`). Pendant ce vol, le
 * décor s'installe derrière lui — backdrop plein écran, d'abord flou et
 * agrandi, qui fait sa mise au point, puis la pile de scrims de la fiche.
 * Quand le visuel se pose, les pixels sous le calque sont déjà les bons : le
 * calque s'efface sans qu'on voie la bascule.
 *
 * C'est la différence avec la version précédente, qui étirait simplement le
 * rectangle jusqu'au plein écran : l'objet cliqué finissait nulle part, et
 * l'arrivée sur la fiche restait une coupure.
 *
 * Repli : sans cible mesurée (média sans affiche, fiche lente), le visuel
 * s'efface sur place en fondu — jamais de blocage.
 */
export function DetailOpenOverlay({ origin, backdropUrl, target, settled = false, ready = true, onCovered, onDone }: DetailOpenOverlayProps) {
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  /** Le visuel s'est posé sur sa cible : il ne reste qu'à attendre que la fiche soit prête. */
  const [landed, setLanded] = useState(false);
  /**
   * Origine déjà lancée. Une ouverture ne se joue QU'UNE FOIS.
   *
   * L'effet ci-dessous dépend de `onDone`, et rien ne garantit qu'un appelant
   * le mémoïse ; il se rejouait donc à chaque rendu de la page. Tant que la
   * cible était mesurée une seule fois, ces rendus étaient rares et le défaut
   * invisible. Dès que la mesure a suivi la mise en page, ils se sont
   * multipliés — et chaque exécution remettait `playing` à vrai, y compris
   * pendant la sortie : l'animation repartait de son point de départ, encore et
   * encore. C'est le clignotement. Le composant se protège lui-même plutôt que
   * de compter sur la discipline de ses appelants.
   */
  const startedFor = useRef<DetailOrigin | null>(null);
  const guardRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** Instant du départ du calque, pour mesurer l'attente réelle. */
  const startedAt = useRef(0);
  /**
   * Course figée à la PREMIÈRE cible, et calculée PENDANT LE RENDU.
   *
   * Un effet l'aurait posée un rendu trop tard : la cible arrive au rendu N et
   * lance le vol, l'effet ne s'exécute qu'après — la durée changerait alors en
   * plein vol, et framer ferait accélérer ou ralentir un objet déjà en
   * mouvement. Une ref calculée à la volée est ici le bon outil : la valeur doit
   * exister dans le même rendu que ce qu'elle décrit, et ne plus jamais bouger.
   */
  const travelRef = useRef(TRAVEL_MIN_S);
  const travelLocked = useRef(false);

  if (target && !travelLocked.current && startedAt.current > 0) {
    travelLocked.current = true;
    const waitedS = (performance.now() - startedAt.current) / 1000;
    travelRef.current = Math.min(TRAVEL_MAX_S, TRAVEL_MIN_S + waitedS * TRAVEL_WAIT_RATIO);
  }
  const travelS = travelRef.current;

  useEffect(() => {
    if (!origin || startedFor.current === origin) return;
    startedFor.current = origin;
    // Sous `prefers-reduced-motion`, la fiche apparaît directement : pas de
    // vol, pas de zoom, aucune surface géante qui traverse l'écran.
    if (reduced) { onDone(); return; }
    startedAt.current = performance.now();
    travelLocked.current = false;
    travelRef.current = TRAVEL_MIN_S;
    setLanded(false);
    setPlaying(true);
  }, [origin, reduced, onDone]);

  // Garde-fou armé à la première cible — c'est de là que part le vol —, ou à
  // l'arrivée d'une fiche qui n'a rien à viser (titre sans affiche : le calque
  // couvrait la page pour toujours). Armé au montage, il expirait pendant
  // l'attente de la requête, là où la transition a le plus de raisons d'exister.
  const hasTarget = target !== null;
  useEffect(() => {
    const delay = openingGuardDelay({ playing, hasTarget, settled });
    if (delay === null) return;
    clearTimeout(guardRef.current);
    guardRef.current = setTimeout(() => setPlaying(false), delay);
  }, [playing, hasTarget, settled]);

  useEffect(() => { if (landed && ready) setPlaying(false); }, [landed, ready]);

  // La base a fini de monter (ou couvrait déjà, depuis un takeover) : la fiche se montre dessous.
  const coveredRef = useRef(onCovered);
  coveredRef.current = onCovered;
  useEffect(() => {
    if (!playing || !origin) return;
    const timer = setTimeout(() => coveredRef.current?.(), origin.covered ? 0 : DECOR_S * 0.45 * 1000);
    return () => clearTimeout(timer);
  }, [playing, origin]);

  // Nettoyage au démontage SEULEMENT : purger le garde-fou à chaque passage de
  // l'effet le supprimerait dès le premier rendu suivant l'ouverture.
  useEffect(() => () => clearTimeout(guardRef.current), []);

  if (!origin || reduced) return null;


  return createPortal(
    <AnimatePresence onExitComplete={onDone}>
      {playing && (
        <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden>
          {/* ── Décor : s'installe pendant que le visuel vole ──────────────
              Le fondu de la base suppose une page visible dessous, à laquelle
              s'enchaîner. Depuis un takeover plein écran (`origin.covered`) il
              n'y en a plus : le takeover s'est retiré d'un bloc, et fondre
              depuis rien rouvrirait pour deux dixièmes de seconde la page
              qu'il masquait. On reprend alors l'écran déjà couvert. */}
          <motion.div
            className="absolute inset-0 bg-surface-0"
            initial={{ opacity: origin.covered ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2, ease: "easeOut" } }}
            transition={{ duration: DECOR_S * 0.45, ease: "easeOut" }}
          />
          {/* Décor monté à l'avance, dans la MÊME boîte que `DetailStage` : à
              l'effacement du calque, les pixels dessous sont déjà identiques,
              donc pas de ressaut. C'est toute sa raison d'être — et c'est
              exactement ce qui s'était cassé quand la bannière a gagné son
              débord de 260 px sans que ce calque le suive : le décor sautait à
              l'atterrissage de chaque ouverture de fiche. Les dimensions
              viennent désormais des mêmes constantes. */}
          <div className={`absolute inset-x-0 top-0 overflow-hidden ${DETAIL_STAGE_BOX}`}>
            {backdropUrl && (
              // Le zoom et l'opacité d'ensemble vivent sur le CONTENEUR, la
              // mise au point sur deux calques superposés.
              //
              // Le flou n'est plus animé : `filter` ne se compose pas, et
              // interpoler son rayon obligeait à reconstruire un flou gaussien
              // sur toute la bannière — plein écran sur 260 px de débord — à
              // chaque image, pendant qu'un vol en propriétés de layout tournait
              // en parallèle. C'était l'opération la plus chère de l'ouverture
              // d'une fiche, c'est-à-dire du geste le plus fréquent de l'app.
              //
              // Ici la copie floutée est rastérisée UNE fois puis s'efface sur
              // l'image nette. Même point de départ, même point d'arrivée ;
              // seule la façon de passer de l'un à l'autre change.
              <motion.div
                className="absolute inset-0"
                // `transform` entier, jamais `scale` seul : framer ne confie au
                // compositeur que celui-là, et la fiche se monte sur le fil principal.
                initial={{ opacity: 0, transform: "scale(1.08)" }}
                animate={{ opacity: 1, transform: "scale(1)" }}
                exit={{ opacity: 0, transition: { duration: 0.2, ease: "easeOut" } }}
                transition={{ duration: DECOR_S * 1.05, ease: SETTLE }}
              >
                <img
                  src={backdropUrl}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ objectPosition: DETAIL_STAGE_FOCUS }}
                />
                <motion.img
                  src={backdropUrl}
                  alt=""
                  draggable={false}
                  aria-hidden
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ filter: "blur(12px)", objectPosition: DETAIL_STAGE_FOCUS }}
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: DECOR_S * 1.05, ease: SETTLE }}
                />
              </motion.div>
            )}
            {/* Sans décor, le repli de la scène : le même, pour une sortie invisible. */}
            {!backdropUrl && <DetailStageFallback />}
            {/* Mêmes voiles, même ordre que la scène (`DETAIL_STAGE_LAYERS`) :
                une liste unique, sinon le décor saute à l'effacement. */}
            {DETAIL_STAGE_LAYERS.map((layer) => (
              <motion.div
                key={layer.background}
                className={layer.className}
                style={{ background: layer.background }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2, ease: "easeOut" } }}
                transition={{ duration: DECOR_S * 0.7, delay: DECOR_S * 0.25, ease: "easeOut" }}
              />
            ))}
          </div>

          {/* ── Le visuel en vol (`DetailFlight`, en transform seul) ─────── */}
          <DetailFlight
            from={origin.rect}
            to={target}
            radius={origin.radius}
            imageUrl={origin.imageUrl}
            travelS={travelS}
            onLanded={() => setLanded(true)}
          />
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
