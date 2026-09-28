import { memo, useRef } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { exitTarget, verdictFromDrag } from "@tentacle-tv/api-client";
import type { SwipeCard, SwipeCardDetails, SwipeVerdict } from "@tentacle-tv/api-client";
import { SwipeCardFace } from "./SwipeCardFace";
import { SwipeStamps } from "./SwipeStamps";

interface SwipeStackCardProps {
  card: SwipeCard;
  depth: number;
  posterUrl: string | null;
  reducedMotion: boolean;
  infoOpen: boolean;
  details: SwipeCardDetails | undefined;
  label: string;
  onJudge: (verdict: SwipeVerdict) => void;
  onToggleInfo: () => void;
}

const SPRING = { type: "spring", stiffness: 420, damping: 32 } as const;

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
  posterUrl,
  reducedMotion,
  infoOpen,
  details,
  label,
  onJudge,
  onToggleInfo,
}: SwipeStackCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-320, 320], [-14, 14]);
  const top = depth === 0;
  // Un glisser relâché SUR la carte déclenche aussi le `onTap` de
  // framer-motion : sans ce drapeau, une carte ramenée à sa place ouvrait
  // son synopsis. Remis à zéro à chaque appui.
  const dragged = useRef(false);

  return (
    <motion.div
      className={`absolute inset-0 touch-none select-none ${top ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{ x, y, rotate, zIndex: 10 - depth }}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 - depth * 0.05, y: depth * 12 }}
      transition={reducedMotion ? { duration: 0.12 } : SPRING}
      custom={null}
      variants={{
        exit: (verdict: SwipeVerdict | null) =>
          reducedMotion || !verdict
            ? { opacity: 0, transition: { duration: 0.12 } }
            : {
                ...exitTarget(verdict, typeof window === "undefined" ? 1200 : window.innerWidth),
                opacity: 0,
                transition: { duration: 0.32, ease: [0.4, 0, 1, 1] },
              },
      }}
      exit="exit"
      drag={top}
      dragMomentum={false}
      onPointerDown={() => {
        dragged.current = false;
      }}
      onDragStart={() => {
        dragged.current = true;
      }}
      onTap={
        top
          ? () => {
              if (!dragged.current) onToggleInfo();
            }
          : undefined
      }
      onDragEnd={(_, info) => {
        const verdict = verdictFromDrag(info.offset.x, info.offset.y, info.velocity.x, info.velocity.y);
        if (verdict) {
          onJudge(verdict);
          return;
        }
        void animate(x, 0, SPRING);
        void animate(y, 0, SPRING);
      }}
      role={top ? "group" : undefined}
      aria-label={top ? label : undefined}
      aria-hidden={top ? undefined : true}
    >
      <SwipeCardFace
        card={card}
        posterUrl={posterUrl}
        interactive={top}
        infoOpen={top && infoOpen}
        details={top ? details : undefined}
        onToggleInfo={onToggleInfo}
      />
      {top && <SwipeStamps x={x} y={y} />}
    </motion.div>
  );
});
