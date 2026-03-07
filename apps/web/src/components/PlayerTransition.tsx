import { useState, useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SplashOctopus } from "./SplashOctopus";

interface PlayerTransitionProps {
  children: ReactNode;
  /** Use transparent background (for desktop mpv player rendering behind WebView2) */
  transparent?: boolean;
  /** Appelé quand l'animation splash est terminée et le lecteur peut démarrer */
  onComplete?: () => void;
}

export type SplashPhase = "enter" | "clap" | "splash" | "exit";

/**
 * Animation d'intro poulpe pirate : apparition → révélation du lecteur vidéo.
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
    const t1 = setTimeout(() => setPhase("exit"), 600);
    const t2 = setTimeout(() => { if (!skippedRef.current) onComplete?.(); }, 1000);
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
            transition={{ duration: 0.4 }}
          >
            {/* Poulpe pirate animé */}
            <motion.div
              className="relative z-10"
              initial={{ scale: 0, opacity: 0, y: 0 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "backOut" }}
            >
              <SplashOctopus phase={phase} size={180} />
            </motion.div>

            {/* Label */}
            <motion.span
              className="absolute bottom-1/3 text-lg font-semibold tracking-widest text-white/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: phase === "enter" ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            >
              TENTACLE
            </motion.span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
