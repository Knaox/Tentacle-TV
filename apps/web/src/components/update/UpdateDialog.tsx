import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useFullscreenPortalTarget } from "../../hooks/useFullscreenPortalTarget";
import { duration, easeDrawer, easeOut } from "../../theme/motion";
import { useLiquidGlassMode } from "../../theme/glass";
import { useGlassControl } from "../ui/glass/useGlassControl";
import { focusableIn } from "../ui/Modal";
import { setUpdateLock, UPDATE_LOCK_PANEL, UPDATE_LOCK_ZONE } from "./updateLock";

interface UpdateDialogProps {
  open: boolean;
  /**
   * La mise à jour TOURNE : la pop-up verrouille tout l'arrière-plan (`updateLock.ts`). Ni Échap,
   * ni clic dehors, ni croix — elle ne s'interrompt pas d'un geste, et rien ne se fait derrière.
   */
  blocking: boolean;
  /** « Plus tard » : Échap et le clic sur le voile, tant que rien n'est lancé. */
  onDismiss: () => void;
  labelledBy: string;
  describedBy?: string;
  children: ReactNode;
}

// `transform` ENTIER, jamais `scale` / `y` seuls : framer 11 ne confie au compositeur que celui-là,
// et cette fenêtre s'ouvre au démarrage, pendant que l'application se charge sur le fil principal.
const PANEL = {
  hidden: { opacity: 0, transform: "translateY(10px) scale(0.97)" },
  show: { opacity: 1, transform: "translateY(0px) scale(1)", transition: { duration: duration.sheetIn, ease: easeDrawer, opacity: { duration: 0.22, ease: easeOut } } },
  exit: { opacity: 0, transform: "translateY(10px) scale(0.97)", transition: { duration: duration.sheetOut, ease: easeOut, opacity: { duration: 0.16, ease: easeOut } } },
} as const;
const PANEL_REDUCED = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: duration.fast } },
  exit: { opacity: 0, transition: { duration: duration.menuOut } },
} as const;

/**
 * La FEUILLE de la mise à jour — la peau et le mouvement de `Modal` (feuille du socle, 320 ms
 * sur la courbe de tiroir, voile sans flou hors verre natif), avec ce que la primitive commune
 * ne sait pas faire :
 *
 *  - elle passe AU-DESSUS de tout (`z-[9500]`) : le lecteur de bandes-annonces (120), les
 *    feuilles du hors ligne (200), « Qui regarde ? » (8000) seraient restés par-dessus une
 *    `Modal` à 100 — sous la seule barre de titre de l'hôte (10000), qui déplace la fenêtre ;
 *  - son portail suit le plein écran du lecteur web (`useFullscreenPortalTarget`) : montée sur
 *    `<body>`, elle disparaissait derrière un film en plein écran ;
 *  - EN COURS (`blocking`), elle pose le verrou : clavier, pointeur, focus et lecture
 *    (`updateLock.ts`). Le voile s'épaissit : derrière, plus rien n'est à faire.
 */
export function UpdateDialog({ open, blocking, onDismiss, labelledBy, describedBy, children }: UpdateDialogProps) {
  const target = useFullscreenPortalTarget();
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Verre natif : le ton du dessous, comme `Modal` — un ton pour la feuille, pas de lentille.
  const glass = useGlassControl<HTMLDivElement>({ lens: false, scale: "surface" });
  const { ref: glassRef } = glass;
  const setPanel = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node;
    glassRef(node);
  }, [glassRef]);
  const reduced = useReducedMotion();
  const native = useLiquidGlassMode() === "native";
  const locked = open && blocking;

  // Le verrou tient tant que la mise à jour tourne ET que la pop-up est à l'écran ; posé dans
  // un effet, donc APRÈS le montage : la zone existe quand l'arrière-plan devient inerte.
  useEffect(() => {
    if (!locked) return undefined;
    setUpdateLock("app", true);
    return () => setUpdateLock("app", false);
  }, [locked]);

  // Tant que rien n'est lancé : Échap vaut « Plus tard », Tab tourne dans la feuille. En cours,
  // le verrou filtre le clavier AVANT cet écouteur (capture) — il n'entend plus rien.
  useEffect(() => {
    if (!open || blocking) return undefined;
    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (e.key === "Escape") { e.preventDefault(); onDismiss(); return; }
      if (e.key !== "Tab" || !panel) return;
      const items = focusableIn(panel);
      const current = document.activeElement;
      const inside = current instanceof HTMLElement && panel.contains(current);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) { e.preventDefault(); panel.focus(); return; }
      if (e.shiftKey ? !inside || current === panel || current === first : !inside || current === panel || current === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, blocking, onDismiss]);

  // Le focus entre dans la feuille à l'ouverture — sur le PANNEAU, pas sur un bouton : elle
  // paraît sans qu'on l'ait demandée, et une touche Entrée ou Espace déjà en route ne doit ni
  // lancer la mise à jour ni la refuser. Il revient d'où il venait à la fermeture ; au passage
  // « en cours », ses boutons partent : il reste sur le panneau, jamais sur la page.
  const lastFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return undefined;
    lastFocus.current = document.activeElement as HTMLElement | null;
    const id = setTimeout(() => {
      panelRef.current?.focus();
    }, 50);
    return () => { clearTimeout(id); lastFocus.current?.focus?.(); };
  }, [open]);
  useEffect(() => {
    if (locked) panelRef.current?.focus();
  }, [locked]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          {...{ [UPDATE_LOCK_ZONE]: "" }}
          data-blocking={blocking || undefined}
          className="lg-scrim fixed inset-0 z-[9500] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: reduced ? 0.12 : 0.2 } }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0.08 : 0.16 } }}
          onClick={blocking ? undefined : onDismiss}
          role="presentation"
          style={native
            ? { background: "var(--glass-backdrop)", backdropFilter: "blur(var(--blur-modal))", WebkitBackdropFilter: "blur(var(--blur-modal))" }
            // En cours : un voile plus dense — l'arrière-plan n'est plus un endroit où agir.
            : { background: blocking ? "rgba(0, 0, 0, 0.78)" : "var(--glass-backdrop)" }}
        >
          <motion.div
            ref={setPanel}
            {...glass.props}
            {...{ [UPDATE_LOCK_PANEL]: "" }}
            role={blocking ? "alertdialog" : "dialog"}
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            aria-busy={blocking || undefined}
            tabIndex={-1}
            className="lg-sheet relative w-full overflow-hidden outline-none"
            style={{ maxWidth: 520, background: "var(--surface-modal)", borderRadius: "var(--radius-3xl)", boxShadow: "var(--shadow-modal)" }}
            variants={reduced ? PANEL_REDUCED : PANEL}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    target,
  );
}
