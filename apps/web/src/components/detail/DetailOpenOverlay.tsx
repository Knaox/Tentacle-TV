import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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

/** Course du visuel : lente et très amortie, elle donne le tempo de la page. */
const TRAVEL_S = 0.72;
/** Décélération franche puis arrivée qui se pose, sans le moindre rebond. */
const SETTLE = [0.16, 1, 0.3, 1] as const;
/** Sécurité : si la fiche ne se mesure jamais, on n'immobilise pas l'écran. */
const FALLBACK_MS = 1400;

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
            exit={{ opacity: 0, transition: { duration: 0.3, ease: "easeOut" } }}
            transition={{ duration: TRAVEL_S * 0.45, ease: "easeOut" }}
          />
          {backdropUrl && (
            <motion.img
              src={backdropUrl}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover"
              initial={{ opacity: 0, scale: 1.14, filter: "blur(18px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, transition: { duration: 0.3, ease: "easeOut" } }}
              transition={{ duration: TRAVEL_S * 1.05, ease: SETTLE }}
            />
          )}
          {/* Scrims de la fiche montés à l'avance : à l'effacement du calque,
              les pixels dessous sont déjà identiques, donc pas de ressaut. */}
          {[
            { style: "var(--detail-scrim-diagonal)", cls: "absolute inset-0" },
            { style: "var(--detail-scrim-bottom)", cls: "absolute inset-x-0 bottom-0 h-[55%]" },
            { style: "var(--detail-brand-wash)", cls: "absolute inset-0" },
          ].map((layer) => (
            <motion.div
              key={layer.style}
              className={layer.cls}
              style={{ background: layer.style }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.3, ease: "easeOut" } }}
              transition={{ duration: TRAVEL_S * 0.7, delay: TRAVEL_S * 0.25, ease: "easeOut" }}
            />
          ))}

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
            exit={{ opacity: 0, transition: { duration: 0.26, delay: 0.06, ease: "easeOut" } }}
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
