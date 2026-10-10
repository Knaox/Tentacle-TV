import { useState, useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SplashOctopus } from "./SplashOctopus";
import { duration } from "../theme/motion";

interface PlayerTransitionProps {
  children: ReactNode;
  /** Use transparent background (for desktop mpv player rendering behind WebView2) */
  transparent?: boolean;
  /** Appelé quand l'animation splash est terminée et le lecteur peut démarrer */
  onComplete?: () => void;
}

export type SplashPhase = "enter" | "clap" | "splash" | "exit";

/** Tenue du poulpe à l'écran avant que le splash ne s'efface. */
const SPLASH_HOLD_MS = 600;
/** Le lecteur démarre quand le fondu de sortie du splash est fini. */
const SPLASH_DONE_MS = SPLASH_HOLD_MS + duration.page * 1000;

/**
 * Animation d'intro poulpe pirate : apparition → révélation du lecteur vidéo.
 *
 * Splash plein écran (fond de scène cinéma) → bg-black/text-white
 * volontairement en dur dans les deux thèmes clair/sombre.
 */
export function PlayerTransition({ children, transparent = false, onComplete }: PlayerTransitionProps) {
  const [phase, setPhase] = useState<SplashPhase>("enter");
  const skippedRef = useRef(false);

  const skipAnimation = () => {
    if (skippedRef.current) return;
    skippedRef.current = true;
    setPhase("exit");
    onComplete?.();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.code === "Space") skipAnimation();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("exit"), SPLASH_HOLD_MS);
    const t2 = setTimeout(() => { if (!skippedRef.current) onComplete?.(); }, SPLASH_DONE_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`relative h-screen w-screen ${transparent ? "" : "bg-black"}`} onClick={skipAnimation}>
      {children}

      <AnimatePresence>
        {phase !== "exit" ? (
          <motion.div
            key="splash-overlay"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black"
            exit={{ opacity: 0 }}
            transition={{ duration: duration.page }}
          >
            {/* Poulpe pirate animé */}
            <motion.div
              className="relative z-10"
              initial={{ scale: 0, opacity: 0, y: 0 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: duration.slow, ease: "backOut" }}
            >
              <SplashOctopus phase={phase} size={180} />
            </motion.div>

            {/* Label */}
            <motion.span
              className="absolute bottom-1/3 text-lg font-semibold tracking-widest text-white/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: phase === "enter" ? 1 : 0 }}
              transition={{ duration: duration.slow }}
            >
              TENTACLE
            </motion.span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
