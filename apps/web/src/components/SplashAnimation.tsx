import { useState, useEffect, useRef, memo } from "react";
import { motion } from "framer-motion";

interface SplashAnimationProps {
  /** True once the video has started playing */
  videoReady: boolean;
  /** Called when the splash is fully done and should be removed */
  onComplete: () => void;
}

const MIN_DURATION = 2500;
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

/** Gouttes d'eau pré-calculées (stable entre renders). */
const drops = Array.from({ length: DROP_COUNT }, (_, i) => ({
  angle: (i / DROP_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.3,
  dist: 90 + Math.random() * 70,
  size: 4 + Math.random() * 8,
  delay: Math.random() * 0.15,
}));

type Phase = "enter" | "clap" | "splash" | "hold" | "exit";

function SplashAnimationInner({ videoReady, onComplete }: SplashAnimationProps) {
  const [phase, setPhase] = useState<Phase>("enter");
  const minPassed = useRef(false);
  const videoWasReady = useRef(false);

  // Phase timeline
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("clap"), 400);
    const t2 = setTimeout(() => { setPhase("splash"); playSplashSound(); }, 1500);
    const t3 = setTimeout(() => setPhase("hold"), 2100);
    const t4 = setTimeout(() => { minPassed.current = true; }, MIN_DURATION);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  // Exit when animation done + video ready
  useEffect(() => {
    if (videoReady) videoWasReady.current = true;
    if (phase !== "hold") return;
    if (minPassed.current || videoWasReady.current) {
      const t = setTimeout(() => setPhase("exit"), 100);
      return () => clearTimeout(t);
    }
    // Poll for readiness
    const id = setInterval(() => {
      if (minPassed.current || videoWasReady.current) setPhase("exit");
    }, 100);
    return () => clearInterval(id);
  }, [phase, videoReady]);

  // Trigger onComplete after exit animation
  useEffect(() => {
    if (phase !== "exit") return;
    const t = setTimeout(onComplete, 450);
    return () => clearTimeout(t);
  }, [phase, onComplete]);

  const octopusVariants = {
    enter: { scale: 0, opacity: 0, y: 0, rotate: 0 },
    clap: { scale: [1, 1.15, 0.92, 1.1, 0.96, 1.05, 1], opacity: 1, y: 0, rotate: [0, -4, 5, -3, 4, -2, 0] },
    splash: { scale: 0.5, opacity: 0.7, y: 80, rotate: 0 },
    hold: { scale: 0.5, opacity: 0.6, y: 80, rotate: 0 },
    exit: { scale: 0.2, opacity: 0, y: 140, rotate: 0 },
  };
  const octopusTransitions: Record<Phase, object> = {
    enter: { duration: 0.35, ease: "backOut" },
    clap: { duration: 1, ease: "easeInOut" },
    splash: { duration: 0.5, ease: "easeIn" },
    hold: { duration: 0.3 },
    exit: { duration: 0.4, ease: "easeIn" },
  };

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black"
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === "exit" ? 0 : 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Poulpe pirate */}
      <motion.img
        src="/tentacle-logo-pirate.svg"
        alt=""
        className="relative z-10"
        draggable={false}
        style={{ width: 180, height: Math.round(180 * (560 / 512)) }}
        initial="enter"
        animate={phase}
        variants={octopusVariants}
        transition={octopusTransitions[phase]}
      />

      {/* Éclaboussures — gouttes d'eau */}
      {(phase === "splash" || phase === "hold" || phase === "exit") && drops.map((d, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: d.size, height: d.size,
            background: `radial-gradient(circle, rgba(147,197,253,0.8), rgba(59,130,246,0.5))`,
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
      {(phase === "splash" || phase === "hold") && [0, 0.12, 0.24].map((delay, i) => (
        <motion.div
          key={`ring-${i}`}
          className="absolute rounded-full border-2 border-blue-400/30"
          initial={{ width: 30, height: 14, opacity: 0.5 }}
          animate={{ width: 220 + i * 50, height: 60 + i * 16, opacity: 0 }}
          transition={{ duration: 0.9, delay, ease: "easeOut" }}
          style={{ marginTop: 100 }}
        />
      ))}
    </motion.div>
  );
}

export const SplashAnimation = memo(SplashAnimationInner);
