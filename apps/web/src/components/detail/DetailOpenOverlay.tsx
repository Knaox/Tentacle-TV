import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DETAIL_HERO_BOX, DETAIL_SCRIM_BOTTOM } from "./DetailHero";
import type { DetailOrigin } from "./detailTransition";

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
/**
 * Sécurité : si la fiche ne se mesure jamais, on n'immobilise pas l'écran.
 *
 * Le compte à rebours part de la première MESURE reçue, pas du montage. Le vol
 * ne peut démarrer qu'une fois la requête revenue et le visuel de la fiche
 * placé : sur une requête lente, un garde-fou lancé au montage coupait le calque
 * avant même que le vol ait commencé.
 */
const FALLBACK_MS = 1000;

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
export function DetailOpenOverlay({ origin, backdropUrl, target, onDone }: DetailOpenOverlayProps) {
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(false);
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
    setPlaying(true);
  }, [origin, reduced, onDone]);

  // Garde-fou armé à la première cible — c'est de là que part le vol. Armé au
  // montage, il expirait pendant l'attente de la requête sur les fiches lentes,
  // exactement là où la transition a le plus de raisons d'exister.
  useEffect(() => {
    if (!playing || !target) return;
    clearTimeout(guardRef.current);
    guardRef.current = setTimeout(() => setPlaying(false), FALLBACK_MS);
  }, [playing, target]);

  // Nettoyage au démontage SEULEMENT : purger le garde-fou à chaque passage de
  // l'effet le supprimerait dès le premier rendu suivant l'ouverture.
  useEffect(() => () => clearTimeout(guardRef.current), []);

  if (!origin || reduced) return null;

  const from = origin.rect;
  // Tant que la fiche n'a pas rendu son visuel, l'image reste à sa place de
  // départ : mieux vaut attendre que partir vers une cible devinée.
  //
  // La bannière d'accueil suit exactement le même trajet que les cartes, et
  // c'est délibéré. Une première version la faisait s'ouvrir jusqu'au plein
  // écran, au motif qu'elle EST déjà le décor de la page d'arrivée. Mais le
  // visuel finissait alors nulle part : la fiche affiche son affiche à un
  // endroit précis, et ne pas s'y poser laissait l'arrivée sans point de
  // chute — le défaut même que la transition doit corriger.
  const to = target ?? from;

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
          {/* Décor monté à l'avance, dans la MÊME boîte que `DetailHero` : à
              l'effacement du calque, les pixels dessous sont déjà identiques,
              donc pas de ressaut. C'est toute sa raison d'être — et c'est
              exactement ce qui s'était cassé quand la bannière a gagné son
              débord de 260 px sans que ce calque le suive : le décor sautait à
              l'atterrissage de chaque ouverture de fiche. Les dimensions
              viennent désormais des mêmes constantes. */}
          <div className={`absolute inset-x-0 top-0 overflow-hidden ${DETAIL_HERO_BOX}`}>
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
                initial={{ opacity: 0, scale: 1.08 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2, ease: "easeOut" } }}
                transition={{ duration: DECOR_S * 1.05, ease: SETTLE }}
              >
                <img
                  src={backdropUrl}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <motion.img
                  src={backdropUrl}
                  alt=""
                  draggable={false}
                  aria-hidden
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ filter: "blur(12px)" }}
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: DECOR_S * 1.05, ease: SETTLE }}
                />
              </motion.div>
            )}
            {[
              { style: "var(--detail-scrim-diagonal)", cls: "absolute inset-0" },
              { style: "var(--detail-scrim-bottom)", cls: `absolute inset-x-0 bottom-0 ${DETAIL_SCRIM_BOTTOM}` },
              { style: "var(--detail-brand-wash)", cls: "absolute inset-0" },
              { style: "var(--detail-page-fade)", cls: "absolute inset-x-0 bottom-0 h-[46%]" },
            ].map((layer) => (
              <motion.div
                key={layer.style}
                className={layer.cls}
                style={{ background: layer.style }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2, ease: "easeOut" } }}
                transition={{ duration: DECOR_S * 0.7, delay: DECOR_S * 0.25, ease: "easeOut" }}
              />
            ))}
          </div>

          {/* ── Le visuel en vol ─────────────────────────────────────────── */}
          <motion.div
            data-detail-flight
            className="absolute overflow-hidden"
            initial={{
              top: from.top,
              left: from.left,
              width: from.width,
              height: from.height,
              borderRadius: origin.radius,
            }}
            animate={{
              top: to.top,
              left: to.left,
              width: to.width,
              height: to.height,
              borderRadius: 12,
            }}
            // Sortie légèrement retardée : le visuel réel de la fiche est déjà
            // dessous, on laisse l'œil s'y poser avant de retirer le calque.
            exit={{ opacity: 0, transition: { duration: 0.18, delay: 0.04, ease: "easeOut" } }}
            transition={{ duration: travelS, ease: SETTLE }}
            onAnimationComplete={() => { if (target) setPlaying(false); }}
            style={{ boxShadow: "var(--elev-3)" }}
          >
            <img
              src={origin.imageUrl}
              alt=""
              draggable={false}
              className="h-full w-full object-cover"
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
