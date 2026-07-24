import { useEffect, useState } from "react";
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
 * Course du visuel. Descendue de 720 à 440 ms : au-delà d'environ 400 ms une
 * transition n'accompagne plus le clic, elle le fait attendre — et celle-ci se
 * joue à CHAQUE ouverture de fiche. La courbe fait tout le travail : très
 * amortie, elle donne encore l'impression d'un objet qui se pose, sans traîner.
 */
const TRAVEL_S = 0.44;
/** Décélération franche puis arrivée qui se pose, sans le moindre rebond. */
const SETTLE = [0.16, 1, 0.3, 1] as const;
/** Sécurité : si la fiche ne se mesure jamais, on n'immobilise pas l'écran. */
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

  useEffect(() => {
    if (!origin) return;
    // Sous `prefers-reduced-motion`, la fiche apparaît directement : pas de
    // vol, pas de zoom, aucune surface géante qui traverse l'écran.
    if (reduced) { onDone(); return; }
    setPlaying(true);
    const guard = setTimeout(() => setPlaying(false), FALLBACK_MS);
    return () => clearTimeout(guard);
  }, [origin, reduced, onDone]);

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
          {/* ── Décor : s'installe pendant que le visuel vole ────────────── */}
          <motion.div
            className="absolute inset-0 bg-surface-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2, ease: "easeOut" } }}
            transition={{ duration: TRAVEL_S * 0.45, ease: "easeOut" }}
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
              <motion.img
                src={backdropUrl}
                alt=""
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover"
                // Zoom et flou de départ réduits (1.08 / 12 px au lieu de 1.14 /
                // 18 px) : sur la course raccourcie, l'ancien réglage devenait
                // une mise au point précipitée — et un flou plein écran animé
                // est la plus coûteuse des opérations de cette transition.
                initial={{ opacity: 0, scale: 1.08, filter: "blur(12px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, transition: { duration: 0.2, ease: "easeOut" } }}
                transition={{ duration: TRAVEL_S * 1.05, ease: SETTLE }}
              />
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
                transition={{ duration: TRAVEL_S * 0.7, delay: TRAVEL_S * 0.25, ease: "easeOut" }}
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
            transition={{ duration: TRAVEL_S, ease: SETTLE }}
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
