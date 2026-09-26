import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Sweep, Veil } from "../../../components/player/overlayPill";
import { useIsTablet } from "../../useMirrorLayout";

/** Les noirs du vocabulaire desktop (séparateur 10 %, croix 55 %). */
const SEPARATOR_BLACK = "rgba(0, 0, 0, 0.10)";
const CROSS_BLACK = "rgba(0, 0, 0, 0.55)";

export interface OverlayPillProps {
  label: string;
  onPress: () => void;
  /** Temps RESTANT à courir (ms) ; `null`/absent = bouton manuel, sans balayage. */
  countdownMs?: number | null;
  /** Point de départ du balayage (0-1) — reprise d'un décompte en cours. */
  initialProgress?: number;
  /** Croix intégrée ; absente = passage non refusable. */
  onDismiss?: () => void;
  dismissLabel?: string;
  /** Pilule étirée (carte / affiche de fin). */
  fullWidth?: boolean;
  /** Icône posée avant le libellé (triangle « lire »). */
  icon?: ReactNode;
}

/**
 * LA pilule blanche du lecteur — `OverlayPill` de l'app, elle-même portée du
 * vocabulaire web (`overlayPill.tsx`, dont on reprend le voile et le balayage) :
 * aplat blanc opaque, jamais de verre sur la vidéo ; voile d'appui en opacité ;
 * balayage pleine hauteur en `scaleX` ; croix intégrée derrière un trait.
 * Hauteur 44 (54 sur tablette), marges 22 × 10, libellé 14 / 17 gras noir.
 */
export function OverlayPill({
  label, onPress, countdownMs, initialProgress = 0, onDismiss, dismissLabel, fullWidth, icon,
}: OverlayPillProps) {
  const isTablet = useIsTablet();
  const armed = typeof countdownMs === "number" && countdownMs > 0;

  return (
    <div
      className={`pointer-events-auto rounded-full ${fullWidth ? "self-stretch" : ""}`}
      style={{ boxShadow: "0 4px 10px rgba(0,0,0,0.35)" }}
    >
      <div
        className="flex flex-row items-stretch overflow-hidden rounded-full bg-white"
        style={{ minHeight: isTablet ? 54 : undefined }}
      >
        <button
          type="button"
          aria-label={label}
          onClick={(e) => { e.stopPropagation(); onPress(); }}
          className="group/pill relative flex min-w-0 shrink grow flex-row items-center justify-center overflow-hidden [-webkit-tap-highlight-color:transparent]"
          style={{ gap: 8, minHeight: 44, paddingInline: 22, paddingBlock: 10 }}
        >
          {armed && <Sweep durationMs={countdownMs} initialProgress={initialProgress} />}
          <Veil className="group-active/pill:opacity-100" />
          {icon && <span className="relative shrink-0">{icon}</span>}
          <span
            className="relative truncate text-black"
            style={{ fontSize: isTablet ? 17 : 14, fontWeight: 700, letterSpacing: 0.1 }}
          >
            {label}
          </span>
        </button>
        {onDismiss && (
          <>
            <span aria-hidden style={{ width: 1, marginBlock: 12, backgroundColor: SEPARATOR_BLACK }} />
            <button
              type="button"
              aria-label={dismissLabel ?? label}
              onClick={(e) => { e.stopPropagation(); onDismiss(); }}
              className="group/cross relative flex items-center justify-center [-webkit-tap-highlight-color:transparent]"
              style={{ minWidth: isTablet ? 52 : 44 }}
            >
              <span
                aria-hidden
                className="absolute inset-1 rounded-full bg-black/[0.07] opacity-0 group-active/cross:opacity-100"
              />
              <X size={isTablet ? 20 : 16} color={CROSS_BLACK} strokeWidth={2.2} className="relative" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
