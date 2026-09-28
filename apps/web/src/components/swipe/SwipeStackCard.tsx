import { memo, useEffect, useRef } from "react";
import { animate, motion, useIsPresent, useMotionValue, useTransform, type TargetAndTransition } from "framer-motion";
import { exitTarget, verdictFromDrag } from "@tentacle-tv/api-client";
import type { SwipeCard, SwipeCardDetails, SwipeVerdict } from "@tentacle-tv/api-client";
import { SwipeCardFace } from "./SwipeCardFace";
import { SwipeStamps } from "./SwipeStamps";

interface SwipeStackCardProps {
  card: SwipeCard;
  depth: number;
  /** Place dans l'empilement (cf. SwipeStack) : la carte qui part la garde. */
  zIndex: number;
  posterUrl: string | null;
  reducedMotion: boolean;
  infoOpen: boolean;
  details: SwipeCardDetails | undefined;
  label: string;
  onJudge: (verdict: SwipeVerdict) => void;
  onToggleInfo: () => void;
  /** Deux verdicts (cf. SwipeStack) : la carte ne glisse qu'à l'horizontale,
   *  ne se retourne pas, et seul l'écart horizontal juge. */
  binary?: boolean;
}

const SPRING = { type: "spring", stiffness: 420, damping: 32 } as const;
/** Mouvement réduit : les cartes se remplacent en fondu — ni zoom ni glissement. */
const REDUCED = { duration: 0, opacity: { duration: 0.12 } } as const;
/** Mouvement réduit : une carte lâchée avant le seuil revient, vite et sans rebond. */
const REDUCED_RETURN = { duration: 0.15, ease: "easeOut" } as const;

/**
 * Une carte de la pile. Celle du dessus se glisse ; les autres attendent,
 * un peu plus petites et plus bas. Tout mouvement est en `transform` et
 * `opacity` (x, y, rotation, échelle) : aucune peinture par image.
 * La sortie part du point où le doigt l'a lâchée, dans la direction du
 * verdict (variante `exit` nourrie par le `custom` d'AnimatePresence).
 */
export const SwipeStackCard = memo(function SwipeStackCard({
  card,
  depth,
  zIndex,
  posterUrl,
  reducedMotion,
  infoOpen,
  details,
  label,
  onJudge,
  onToggleInfo,
  binary = false,
}: SwipeStackCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  // L'opacité passe par une valeur À NOUS : framer-motion l'anime alors sur le
  // fil principal. Confiée au navigateur (WAAPI), sa fin rendait pour une image
  // l'ancien style en ligne — un éclair de la carte sortante, ou de l'entrante.
  const opacity = useMotionValue(1);
  const rotate = useTransform(x, [-320, 320], [-14, 14]);
  const top = depth === 0;
  // Une carte qui part garde le dessus (son rang d'arrivée) jusqu'au bout, sans
  // plus rien capter : ni pointeur, ni focus, ni lecteur d'écran.
  const isPresent = useIsPresent();
  // Un glisser relâché SUR la carte déclenche aussi le `onTap` de
  // framer-motion : sans ce drapeau, une carte ramenée à sa place ouvrait
  // son synopsis. Remis à zéro à chaque appui.
  const dragged = useRef(false);
  // La sortie se fige au premier calcul : AnimatePresence re-résout la
  // variante à chaque rendu, et le `custom` suit la DERNIÈRE carte jugée —
  // deux verdicts rapprochés faisaient changer de cap la première.
  const exitRef = useRef<TargetAndTransition | null>(null);
  useEffect(() => {
    if (isPresent) exitRef.current = null;
  }, [isPresent]);

  return (
    <motion.div
      className={`absolute inset-0 touch-none select-none ${top ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{
        x,
        y,
        rotate,
        opacity,
        zIndex,
        pointerEvents: isPresent ? undefined : "none",
      }}
      inert={!isPresent}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
      // `x: 0` n'agit qu'au retour d'une carte rendue par « annuler » en pleine
      // sortie : sans lui, framer-motion ne ramenait pas x, et la carte restait
      // accrochée au bord. Pendant un glisser, la cible ne change pas : rien ne bouge.
      animate={{ opacity: 1, scale: 1 - depth * 0.05, x: 0, y: depth * 12 }}
      transition={reducedMotion ? REDUCED : SPRING}
      custom={null}
      variants={{
        exit: (verdict: SwipeVerdict | null) => {
          if (exitRef.current) return exitRef.current;
          const width = typeof window === "undefined" ? 1200 : window.innerWidth;
          exitRef.current =
            reducedMotion || !verdict
              ? { opacity: 0, transition: { duration: 0.12 } }
              : {
                  ...exitTarget(verdict, width, { x: x.get(), y: y.get() }),
                  opacity: 0,
                  transition: { duration: 0.32, ease: [0.4, 0, 1, 1] },
                };
          return exitRef.current;
        },
      }}
      exit="exit"
      drag={top ? (binary ? "x" : true) : false}
      dragMomentum={false}
      onPointerDown={() => {
        dragged.current = false;
      }}
      onDragStart={() => {
        dragged.current = true;
      }}
      onTap={
        top && !binary
          ? () => {
              if (!dragged.current) onToggleInfo();
            }
          : undefined
      }
      onDragEnd={(_, info) => {
        // Deux verdicts : la carte suit le doigt à l'horizontale seulement, et
        // c'est ce qu'elle montre qui juge — l'écart vertical ne compte pas.
        const verdict = binary
          ? verdictFromDrag(info.offset.x, 0, info.velocity.x, 0)
          : verdictFromDrag(info.offset.x, info.offset.y, info.velocity.x, info.velocity.y);
        if (verdict) {
          onJudge(verdict);
          return;
        }
        const back = reducedMotion ? REDUCED_RETURN : SPRING;
        void animate(x, 0, back);
        void animate(y, 0, back);
      }}
      role={top ? "group" : undefined}
      aria-label={top ? label : undefined}
      aria-hidden={top ? undefined : true}
    >
      <SwipeCardFace
        card={card}
        posterUrl={posterUrl}
        interactive={top && !binary}
        infoOpen={top && infoOpen}
        details={details}
        onToggleInfo={onToggleInfo}
      />
      {top && <SwipeStamps x={x} y={y} binary={binary} />}
    </motion.div>
  );
});
