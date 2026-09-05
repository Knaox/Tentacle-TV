import { motion } from "framer-motion";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { STAGE_H, STAGE_W, sceneTween } from "./sceneMotion";

interface SceneStageProps {
  /** Clé de remontage : change à chaque boucle de l'horloge (cf. useSceneClock). */
  cycle?: number;
  children: ReactNode;
}

/**
 * Le cadre commun des scènes : 16:9, coins arrondis, fond en dégradé statique,
 * `overflow-hidden`, décoratif (`aria-hidden`, aucun pointeur — le sens est
 * porté par le titre et le texte à côté). À l'intérieur, un canevas LOGIQUE de
 * 640×360 mis à l'échelle en `transform` : les scènes s'écrivent en px exacts
 * et se ressemblent à toutes les largeurs. Le canevas se remonte à chaque
 * boucle (clé `cycle`) derrière un court fondu — pas de rembobinage.
 */
export function SceneStage({ cycle = 0, children }: SceneStageProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => setScale(frame.clientWidth / STAGE_W);
    measure();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frameRef}
      aria-hidden
      className="pointer-events-none relative aspect-video w-full select-none overflow-hidden rounded-[var(--radius-lg)] border border-line-subtle"
      style={{
        background:
          "linear-gradient(135deg, rgba(var(--brand-rgb), 0.22) 0%, var(--surface-1) 40%, var(--surface-2) 72%, rgba(var(--brand-accent-rgb), 0.2) 100%)",
      }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}
      >
        <motion.div
          key={cycle}
          className="relative h-full w-full"
          initial={cycle === 0 ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={sceneTween}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
