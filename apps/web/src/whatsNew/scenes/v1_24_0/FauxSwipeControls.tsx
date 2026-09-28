import { useTranslation } from "react-i18next";
import { Heart, SkipForward, Star, Undo2, X, type LucideIcon } from "lucide-react";
import { Place } from "../Place";

type ControlKey = "undo" | "dislike" | "superlike" | "like" | "skip";

const SPECS: ReadonlyArray<{ key: ControlKey; Icon: LucideIcon; lg: boolean; tone: string; label: string }> = [
  { key: "undo", Icon: Undo2, lg: false, tone: "text-content-secondary", label: "undoShort" },
  { key: "dislike", Icon: X, lg: true, tone: "text-rose-400", label: "dislike" },
  { key: "superlike", Icon: Star, lg: true, tone: "text-white", label: "superlike" },
  { key: "like", Icon: Heart, lg: true, tone: "text-emerald-400", label: "like" },
  { key: "skip", Icon: SkipForward, lg: false, tone: "text-content-secondary", label: "skip" },
];

export const CONTROL_COL = 58;

/**
 * Les cinq gestes en boutons (`SwipeControls`) — les mêmes teintes que l'app ;
 * `canUndo` éteint Annuler tant qu'aucun verdict n'est tombé.
 */
export function FauxSwipeControls({ x, y, canUndo, visible }: { x: number; y: number; canUndo: boolean; visible: boolean }) {
  const { t } = useTranslation("swipe");
  return (
    <Place x={x} y={y} w={CONTROL_COL * SPECS.length} visible={visible} dy={visible ? 0 : 8}>
      <div className="flex items-start">
        {SPECS.map(({ key, Icon, lg, tone, label }) => (
          <div key={key} className="flex flex-col items-center gap-1" style={{ width: CONTROL_COL }}>
            <span
              className={`flex items-center justify-center rounded-full border ${lg ? "h-10 w-10" : "h-8 w-8"} ${
                key === "superlike"
                  ? "border-transparent bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] shadow-lg"
                  : "border-line-subtle bg-surface-2"
              } ${tone} ${key === "undo" && !canUndo ? "opacity-40" : ""}`}
            >
              <Icon size={lg ? 18 : 14} strokeWidth={key === "dislike" ? 3 : 2.2} className={key === "like" || key === "superlike" ? "fill-current" : ""} />
            </span>
            <span className="whitespace-nowrap text-[8px] font-medium leading-tight text-content-tertiary">{t(label)}</span>
          </div>
        ))}
      </div>
    </Place>
  );
}
