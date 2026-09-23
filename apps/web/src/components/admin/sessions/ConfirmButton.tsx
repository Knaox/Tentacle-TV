import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Square, type LucideIcon } from "lucide-react";
import { ActionPill, type PillStatus } from "./ActionPill";

/**
 * Une action destructive en deux temps : le bouton ouvre une BULLE ancrée à
 * lui — la question, ce qu'elle entraîne, « Annuler » qui a le focus. Un
 * réflexe de clic ou d'Entrée n'arrête donc rien.
 *
 * Une bulle plutôt que la rangée qui se transformait sur place : la carte
 * reste sous les yeux pendant qu'on confirme, et plus rien ne se décale sous
 * le pointeur. Elle s'ouvre au-dessus du bouton, ou dessous s'il n'y a pas la
 * place. Échap et un clic dehors la ferment.
 *
 * Fond OPAQUE, celui du panneau « Plus » : à 0,95 d'alpha, le texte de la
 * carte transparaissait sous la question.
 */

const ROOM_ABOVE_PX = 190;

export function ConfirmButton({
  label,
  icon = Square,
  busyLabel,
  title,
  body,
  confirmLabel,
  cancelLabel,
  status = "idle",
  onConfirm,
  className = "",
}: {
  label: string;
  icon?: LucideIcon;
  busyLabel?: string;
  /** La question : « Arrêter la lecture ? ». */
  title: string;
  /** Ce que la personne en face va voir. */
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  status?: PillStatus;
  onConfirm: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const titleId = useId();
  const bodyId = useId();

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      close(true);
    };
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) close(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open, close]);

  const toggle = () => {
    if (open) {
      close(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    setAbove(rect === undefined || rect.top > ROOM_ABOVE_PX);
    setOpen(true);
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <ActionPill
        ref={triggerRef}
        tone="danger"
        icon={icon}
        label={label}
        busyLabel={busyLabel}
        status={status}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
      />
      {open && (
        <div
          id={panelId}
          role="alertdialog"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          className={`absolute right-0 z-30 w-[min(18rem,calc(100vw-2rem))] animate-scale-in rounded-2xl border border-line-subtle bg-[color:var(--nav-panel-bg)] p-4 shadow-[var(--shadow-dropdown)] ${
            above ? "bottom-full mb-2 origin-bottom-right" : "top-full mt-2 origin-top-right"
          }`}
        >
          <p id={titleId} className="text-sm font-semibold text-content-primary">{title}</p>
          <p id={bodyId} className="mt-1 text-[13px] leading-relaxed text-content-tertiary">{body}</p>
          <div className="mt-4 flex justify-end gap-2">
            {/* Le refus a le focus : un réflexe d'Entrée n'arrête rien. */}
            <ActionPill autoFocus size="sm" label={cancelLabel} onClick={() => close(true)} />
            <ActionPill
              size="sm"
              tone="dangerSolid"
              icon={icon}
              label={confirmLabel}
              onClick={() => {
                close(true);
                onConfirm();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
