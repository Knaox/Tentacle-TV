import { useState, useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SplashOctopus } from "./SplashOctopus";

interface PlayerTransitionProps {
  children: ReactNode;
  /** Use transparent background (for desktop mpv player rendering behind WebView2) */
  transparent?: boolean;
}

const DROP_COUNT = 14;

/** Splash sonore procédural — bruit blanc filtré façon éclaboussure. */
function playSplashSound() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const dur = 0.55;
    const len = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.11));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 700; bp.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(bp).connect(gain).connect(ctx.destination);
    src.start();
    setTimeout(() => ctx.close(), 1200);
  } catch { /* autoplay policy ou pas de Web Audio */ }
}

/** Gouttes d'eau pré-calculées. */
const drops = Array.from({ length: DROP_COUNT }, (_, i) => ({
  angle: (i / DROP_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.3,
  dist: 90 + Math.random() * 70,
  size: 4 + Math.random() * 8,
  delay: Math.random() * 0.15,
}));

export type SplashPhase = "enter" | "clap" | "splash" | "exit";

/**
 * Animation d'intro poulpe pirate : apparition → claque des tentacules →
 * plongeon avec éclaboussures + son → révélation du lecteur vidéo.
 */
export function PlayerTransition({ children, transparent = false }: PlayerTransitionProps) {
  const [phase, setPhase] = useState<SplashPhase>("enter");
  const soundPlayed = useRef(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("clap"), 400);
    const t2 = setTimeout(() => {
      setPhase("splash");
      if (!soundPlayed.current) { soundPlayed.current = true; playSplashSound(); }
    }, 1500);
    const t3 = setTimeout(() => setPhase("exit"), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const showSplashFx = phase === "splash" || phase === "exit";

  return (
    <div className={`relative h-screen w-screen ${transparent ? "" : "bg-black"}`}>
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
              animate={
                phase === "enter" ? { scale: 1, opacity: 1, y: 0 } :
                phase === "clap" ? { scale: 1, opacity: 1, y: 0 } :
                { scale: 0.5, opacity: 0.7, y: 80 }
              }
              transition={
                phase === "enter" ? { duration: 0.35, ease: "backOut" } :
                phase === "splash" ? { duration: 0.5, ease: "easeIn" } :
                { duration: 0.3 }
              }
            >
              <SplashOctopus phase={phase} size={180} />
            </motion.div>

            {/* Éclaboussures — gouttes d'eau */}
            {showSplashFx && drops.map((d, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: d.size, height: d.size,
                  background: "radial-gradient(circle, rgba(147,197,253,0.8), rgba(59,130,246,0.5))",
                }}
                initial={{ x: 0, y: 20, opacity: 0.9, scale: 1 }}
                animate={{
                  x: Math.cos(d.angle) * d.dist,
                  y: Math.sin(d.angle) * d.dist + 50,
                  opacity: 0,
                  scale: 0.2,
                }}
                transition={{ duration: 0.7, delay: d.delay, ease: "easeOut" }}
              />
            ))}

            {/* Ondes concentriques */}
            {phase === "splash" && [0, 0.12, 0.24].map((delay, i) => (
              <motion.div
                key={`ring-${i}`}
                className="absolute rounded-full border-2 border-blue-400/30"
                initial={{ width: 30, height: 14, opacity: 0.5 }}
                animate={{ width: 220 + i * 50, height: 60 + i * 16, opacity: 0 }}
                transition={{ duration: 0.9, delay, ease: "easeOut" }}
                style={{ marginTop: 100 }}
              />
            ))}

            {/* Label */}
            <motion.span
              className="absolute bottom-1/3 text-lg font-semibold tracking-widest text-white/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: phase === "clap" ? 1 : 0 }}
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
