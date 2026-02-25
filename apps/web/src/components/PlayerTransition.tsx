import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PlayerTransitionProps {
  children: ReactNode;
}

/**
 * Cinematic "lights out → curtain open → reveal" animation
 * when entering the video player.
 */
export function PlayerTransition({ children }: PlayerTransitionProps) {
  const [phase, setPhase] = useState<"curtain" | "done">("curtain");

  useEffect(() => {
    const t = setTimeout(() => setPhase("done"), 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative h-screen w-screen bg-black">
      {children}

      <AnimatePresence>
        {phase === "curtain" && (
          <>
            {/* Left curtain panel */}
            <motion.div
              key="curtain-left"
              className="fixed inset-y-0 left-0 z-50 w-1/2 bg-gradient-to-r from-[#0a0a0a] to-[#121212]"
              initial={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.4, ease: [0.65, 0, 0.35, 1], delay: 0.2 }}
            >
              <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-purple-500/30 to-transparent" />
            </motion.div>

            {/* Right curtain panel */}
            <motion.div
              key="curtain-right"
              className="fixed inset-y-0 right-0 z-50 w-1/2 bg-gradient-to-l from-[#0a0a0a] to-[#121212]"
              initial={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.4, ease: [0.65, 0, 0.35, 1], delay: 0.2 }}
            >
              <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-purple-500/30 to-transparent" />
            </motion.div>

            {/* Center logo — fades, then curtains open */}
            <motion.div
              key="logo"
              className="fixed inset-0 z-50 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.2, opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="flex flex-col items-center gap-2"
              >
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 shadow-lg shadow-purple-500/30" />
                <span className="text-lg font-semibold tracking-wider text-white/80">TENTACLE</span>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
