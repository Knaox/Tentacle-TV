import { memo, useState } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { InfoIcon } from "@phosphor-icons/react/dist/csr/Info";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { motion, useReducedMotion } from "framer-motion";
import { useMessageCountdown } from "./session/useMessageCountdown";
import { duration, easeOut, exitDuration } from "../theme/motion";
import { useGlassControl } from "./ui/glass/useGlassControl";

interface ToastProps {
  id: number;
  type: "success" | "error" | "info";
  title?: string;
  message: string;
  /** Un geste à côté du message ; il ferme l'avis. */
  action?: { label: string; onPress: () => void };
  /** Un second geste, sous le message, avant le premier (deux gestes ne tiennent pas à côté du texte). */
  secondaryAction?: { label: string; onPress: () => void };
  onDismiss: (id: number) => void;
}

/**
 * Le ton d'un avis : une surface d'encre OPAQUE pour tous (refonte de nov. 2026 — plus de fond
 * teinté translucide ni de flou), et la couleur dans le pictogramme et la barre du temps seuls.
 */
const TONES = {
  success: { Icon: CheckCircleIcon, color: "var(--status-success-fg)" },
  error: { Icon: WarningCircleIcon, color: "var(--status-error-fg)" },
  info: { Icon: InfoIcon, color: "var(--accent)" },
};

/** Une erreur explique (titre et cause) : un peu plus de temps pour la lire. */
const DURATION_MS = { success: 4000, info: 4000, error: 6000 } as const;
const ACTION_DURATION_MS = 7000;

/**
 * Un message bref. Il s'efface seul — sauf tant qu'on le survole ou qu'on y
 * a mis le focus, ou fenêtre cachée (`useMessageCountdown`) ; un clic le
 * ferme. La barre qui se vide est une animation CSS de `transform`, suspendue
 * en même temps : plus de rendu React vingt fois par seconde pour la tenir.
 */
export const Toast = memo(function Toast({ id, type, title, message, action, secondaryAction, onDismiss }: ToastProps) {
  const reduced = useReducedMotion() ?? false;
  const [held, setHeld] = useState(false);
  // Un avis qui porte un geste (« Annuler », « Changer ») laisse le temps de le faire.
  const durationMs = action || secondaryAction ? Math.max(ACTION_DURATION_MS, DURATION_MS[type]) : DURATION_MS[type];
  const countdown = useMessageCountdown(durationMs, held, () => onDismiss(id));
  const tone = TONES[type];
  // En mode natif : la lentille exacte du galet, et le matériau d'une SURFACE
  // (lot lg2) — un avis qui flotte est un grand verre d'un seul ton, tenu.
  const glass = useGlassControl<HTMLDivElement>({ lens: "regular", scale: "surface" });

  return (
    <motion.div
      ref={glass.ref}
      data-lgc-lens={glass.props["data-lgc-lens"]}
      data-lg-scale={glass.props["data-lg-scale"]}
      data-lg-tone={glass.props["data-lg-tone"]}
      // Il monte du bas de l'écran et y redescend, plus vite : même chemin à l'aller et au retour.
      initial={{ opacity: 0, y: reduced ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : 16, transition: { duration: exitDuration(duration.base) } }}
      transition={{ duration: duration.base, ease: easeOut }}
      role={type === "error" ? "alert" : "status"}
      data-tone={type}
      // Opaque, donc sans flou : il n'y aurait rien de visible à flouter (règle « Coût GPU »).
      className="lg-toast pointer-events-auto relative flex min-w-[280px] max-w-sm cursor-pointer items-start gap-2.5 overflow-hidden rounded-tile bg-surface-3 px-4 py-3 text-sm text-content-primary shadow-menu"
      style={glass.props.style}
      onClick={() => onDismiss(id)}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
    >
      {glass.layers}
      <tone.Icon size={18} weight="fill" aria-hidden className="relative mt-px shrink-0" style={{ color: tone.color }} />
      <div className="relative min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className="flex items-center justify-between gap-3">
          <p className={title ? "mt-0.5 text-content-secondary" : "font-medium"}>{message}</p>
          {action && !secondaryAction && <ToastButton action={action} onDone={() => onDismiss(id)} />}
        </div>
        {action && secondaryAction && (
          <div className="mt-2 flex items-center justify-end gap-1">
            <ToastButton action={secondaryAction} onDone={() => onDismiss(id)} quiet />
            <ToastButton action={action} onDone={() => onDismiss(id)} />
          </div>
        )}
      </div>
      <span aria-hidden className="absolute bottom-0 left-0 block h-0.5 w-full motion-reduce:hidden">
        <span
          className="block h-full origin-left animate-countdown"
          style={{
            background: tone.color,
            animationDuration: `${durationMs}ms`,
            animationPlayState: countdown?.running ? "running" : "paused",
          }}
        />
      </span>
    </motion.div>
  );
});

function ToastButton({ action, onDone, quiet = false }: { action: { label: string; onPress: () => void }; onDone: () => void; quiet?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        action.onPress();
        onDone();
      }}
      className={`relative shrink-0 cursor-pointer rounded-md px-2 py-1 font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus before:absolute before:-inset-2 before:content-[''] ${quiet ? "text-content-secondary" : "text-accent"}`}
    >
      {action.label}
    </button>
  );
}
