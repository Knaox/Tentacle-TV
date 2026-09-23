import { motion } from "framer-motion";
import type { ScenePoster } from "../../sceneMedia";
import { CARD_TONES, Place, sceneTween, type Animated, type Placed } from "..";

/**
 * Une carte de « Sessions en direct », en faux : affiche, titre, appareil,
 * barre de lecture, état, et les boutons du tableau de bord. Même anatomie
 * que `components/admin/sessions/SessionCard` — mêmes jetons, en plus petit.
 */

type Tone = "success" | "warning" | "info" | "neutral";

const TONES: Record<Tone, string> = {
  success: "bg-status-success-bg text-status-success-fg",
  warning: "bg-status-warning-bg text-status-warning-fg",
  info: "bg-status-info-bg text-status-info-fg",
  neutral: "bg-fill-soft text-content-secondary",
};

export interface FauxSessionAction {
  label: string;
  /** Visé par le curseur : le calque de marque se révèle (opacité, jamais un fond animé). */
  highlighted?: boolean;
  danger?: boolean;
}

interface FauxSessionCardProps extends Placed, Animated {
  title: string;
  subtitle: string;
  /** 0..1. */
  progress: number;
  poster?: ScenePoster | null;
  tone?: number;
  chip?: { label: string; tone: Tone };
  actions?: FauxSessionAction[];
}

export function FauxSessionCard({
  title, subtitle, progress, poster, tone = 0, chip, actions, w = 280, ...place
}: FauxSessionCardProps) {
  return (
    <Place {...place} w={w}>
      <div className="flex gap-3 rounded-xl border border-line-subtle bg-surface-1 p-3">
        <div className="h-[72px] w-12 shrink-0 overflow-hidden rounded-md" style={{ background: CARD_TONES[tone % CARD_TONES.length] }}>
          {poster && <img src={poster.url} alt="" draggable={false} className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="truncate text-[13px] font-semibold leading-tight text-content-primary">{title}</p>
          <p className="truncate text-[11px] text-content-tertiary">{subtitle}</p>
          <div className="h-1 overflow-hidden rounded-full bg-fill-soft">
            <motion.div
              className="h-full w-full origin-left rounded-full bg-[var(--brand)]"
              initial={false}
              animate={{ scaleX: Math.max(0, Math.min(1, progress)) }}
              transition={sceneTween}
            />
          </div>
          {chip && (
            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${TONES[chip.tone]}`}>{chip.label}</span>
          )}
          {/* Les boutons sur leur propre ligne : un libellé qui change (Pause →
              Reprendre) ne fait pas sauter l'état au-dessus. */}
          {actions && (
            <div className="flex items-center gap-1.5">
              {actions.map((action) => (
                <span
                  key={action.label}
                  className={`relative overflow-hidden rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                    action.danger
                      ? "border-[var(--status-error)]/30 bg-[var(--status-error-bg)] text-[var(--status-error-fg)]"
                      : "border-line-subtle bg-fill-soft text-content-primary"
                  }`}
                >
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 bg-[var(--brand-soft)] ring-1 ring-inset ring-[rgba(var(--brand-rgb),0.6)]"
                    initial={false}
                    animate={{ opacity: action.highlighted ? 1 : 0 }}
                    transition={sceneTween}
                  />
                  <span className="relative">{action.label}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Place>
  );
}
