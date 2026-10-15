import { ChevronLeft, Maximize, Play, Settings, Volume2 } from "lucide-react";
import { easeOut } from "../../../theme/motion";
import { Place, type Animated } from "../Place";

interface FauxPlayerChromeProps extends Animated {
  title: string;
  /** « 1:31:04 / 2:08:40 » — la position, et la durée quand on la connaît. */
  time: string;
  /** 0..1 : la part lue, sur la barre de progression. */
  progress: number;
}

/** La hauteur de la barre du bas, dégradé compris : ce dont l'encart monte quand elle paraît. */
export const PLAYER_BOTTOM_BAR_H = 52;

/** Le fondu des contrôles du lecteur (`transition-opacity duration-300`). */
const FADE = { duration: 0.3, ease: easeOut } as const;

/**
 * Les contrôles du lecteur de bureau, en faux, au balisage de
 * `DesktopPlayerControls` (recopié : le vrai pilote mpv) — en haut, le retour
 * et le titre sur un dégradé noir ; en bas, la barre de progression, la
 * lecture (ici en pause : le triangle), « -10 » et « +30 », le volume, le
 * minutage, puis réglages et plein écran. Deux dégradés cantonnés aux barres,
 * jamais un voile plein cadre.
 */
export function FauxPlayerChrome({ title, time, progress, ...animated }: FauxPlayerChromeProps) {
  return (
    <Place x={0} y={0} w={640} h={360} transition={FADE} {...animated}>
      <div className="absolute inset-x-0 top-0 h-[64px] bg-gradient-to-b from-black/70 to-transparent" />
      <div className="absolute left-[14px] top-[14px] flex items-center gap-2 text-white">
        <ChevronLeft size={18} strokeWidth={2.2} aria-hidden />
        <span className="max-w-[420px] truncate text-[13px] font-semibold">{title}</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent" style={{ height: PLAYER_BOTTOM_BAR_H + 26 }} />
      <div className="absolute inset-x-[18px] text-white" style={{ bottom: 12 }}>
        <div className="mb-2 h-[4px] rounded-full bg-white/20">
          <div className="h-full rounded-full" style={{ width: `${Math.round(progress * 100)}%`, background: "var(--progress-fill)" }} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[9px] font-bold text-white/70">-10</span>
            <Play size={16} fill="currentColor" strokeWidth={0} aria-hidden />
            <span className="text-[9px] font-bold text-white/70">+30</span>
            <Volume2 size={14} strokeWidth={2} aria-hidden />
            <span className="text-[10px] tabular-nums text-white/60">{time}</span>
          </div>
          <div className="flex items-center gap-3">
            <Settings size={14} strokeWidth={2} aria-hidden />
            <Maximize size={14} strokeWidth={2} aria-hidden />
          </div>
        </div>
      </div>
    </Place>
  );
}
