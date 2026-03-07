import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface ToastProps {
  type: "success" | "error" | "info";
  message: string;
  onDismiss: () => void;
}

const COLORS = {
  success: { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.3)", bar: "#10b981" },
  error: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.3)", bar: "#ef4444" },
  info: { bg: "rgba(139,92,246,0.15)", border: "rgba(139,92,246,0.3)", bar: "#8b5cf6" },
};

export function Toast({ type, message, onDismiss }: ToastProps) {
  const [progress, setProgress] = useState(100);
  const c = COLORS[type];

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / 4000) * 100);
      setProgress(remaining);
      if (remaining <= 0) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      transition={{ duration: 0.2 }}
      className="relative min-w-[280px] max-w-sm cursor-pointer overflow-hidden rounded-lg px-4 py-3 text-sm text-white shadow-lg"
      style={{ background: c.bg, border: `1px solid ${c.border}`, backdropFilter: "blur(12px)" }}
      onClick={onDismiss}
    >
      {message}
      <div
        className="absolute bottom-0 left-0 h-0.5 transition-none"
        style={{ width: `${progress}%`, background: c.bar }}
      />
    </motion.div>
  );
}
