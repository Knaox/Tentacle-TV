import { memo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useMessageCountdown } from "./session/useMessageCountdown";
import { duration, exitDuration } from "../theme/motion";
import { useGlassControl } from "./ui/glass/useGlassControl";

interface ToastProps {
  id: number;
  type: "success" | "error" | "info";
  title?: string;
  message: string;
  onDismiss: (id: number) => void;
}

const COLORS = {
  success: {
    bg: "var(--status-success-bg)",
    border: "rgba(16,185,129,0.32)",
    bar: "var(--status-success-fg)",
  },
  error: {
    bg: "var(--status-error-bg)",
    border: "rgba(239,68,68,0.32)",
    bar: "var(--status-error-fg)",
  },
  info: {
    bg: "var(--brand-soft)",
    border: "rgba(var(--brand-rgb), 0.32)",
    bar: "var(--brand)",
  },
};

/** Une erreur explique (titre et cause) : un peu plus de temps pour la lire. */
const DURATION_MS = { success: 4000, info: 4000, error: 6000 } as const;

/**
 * Un message bref. Il s'efface seul — sauf tant qu'on le survole ou qu'on y
 * a mis le focus, ou fenêtre cachée (`useMessageCountdown`) ; un clic le
 * ferme. La barre qui se vide est une animation CSS de `transform`, suspendue
 * en même temps : plus de rendu React vingt fois par seconde pour la tenir.
 */
export const Toast = memo(function Toast({ id, type, title, message, onDismiss }: ToastProps) {
  const reduced = useReducedMotion() ?? false;
  const [held, setHeld] = useState(false);
  const durationMs = DURATION_MS[type];
  const countdown = useMessageCountdown(durationMs, held, () => onDismiss(id));
  const c = COLORS[type];
  // En mode natif : la lentille exacte du galet, et le matériau d'une SURFACE
  // (lot lg2) — un avis qui flotte est un grand verre d'un seul ton, tenu.
  const glass = useGlassControl<HTMLDivElement>({ lens: "regular", scale: "surface" });

  return (
    <motion.div
      ref={glass.ref}
      data-lgc-lens={glass.props["data-lgc-lens"]}
      data-lg-scale={glass.props["data-lg-scale"]}
      data-lg-tone={glass.props["data-lg-tone"]}
      initial={{ opacity: 0, x: reduced ? 0 : 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: reduced ? 0 : 50, transition: { duration: exitDuration(duration.base) } }}
      transition={{ duration: duration.base }}
      role={type === "error" ? "alert" : "status"}
      data-tone={type}
      /* `backdrop-blur-md` en classe et non en style en ligne : un attribut
         `style` échappe à la passe de verre du portage téléviseur, où un flou
         d'arrière-plan coûte une recopie et un recalcul par image sans rien
         apporter. La classe rend le même flou sur le web. */
      className="lg-toast relative min-w-[280px] max-w-sm cursor-pointer overflow-hidden rounded-lg px-4 py-3 text-sm text-content-primary shadow-lg backdrop-blur-md"
      style={{ background: c.bg, border: `1px solid ${c.border}`, ...glass.props.style }}
      onClick={() => onDismiss(id)}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
    >
      {glass.layers}
      {title && <p className="font-semibold">{title}</p>}
      <p className={title ? "mt-0.5 text-content-secondary" : undefined}>{message}</p>
      <span aria-hidden className="absolute bottom-0 left-0 block h-0.5 w-full motion-reduce:hidden">
        <span
          className="block h-full origin-left animate-countdown"
          style={{
            background: c.bar,
            animationDuration: `${durationMs}ms`,
            animationPlayState: countdown?.running ? "running" : "paused",
          }}
        />
      </span>
    </motion.div>
  );
});
