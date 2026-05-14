import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

// Important : on ne déclare whileHover/whileTap QUE si la card est cliquable.
// Sinon, framer-motion installe quand même des handlers onPointerDown/onPointerUp
// sur le wrapper, ce qui — sous React 19 + Framer Motion 11 — peut intercepter le
// click qui doit déclencher le submit d'un <form> enfant. Symptôme : page refresh
// silencieuse au "Se connecter" (le form retombe sur son comportement natif GET
// car le handler React onSubmit n'est jamais notifié). Voir Login/Register.
export function GlassCard({ children, className = "", onClick }: GlassCardProps) {
  const interactive = !!onClick;
  return (
    <motion.div
      {...(interactive
        ? {
            whileHover: { scale: 1.02 },
            whileTap: { scale: 0.98 },
            onClick,
            role: "button",
            tabIndex: 0,
          }
        : {})}
      className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl ${className}`}
    >
      {children}
    </motion.div>
  );
}
