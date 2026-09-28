import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Heart, SkipForward, Star, Undo2, X, type LucideIcon } from "lucide-react";
import type { SwipeVerdict } from "@tentacle-tv/api-client";

interface SwipeControlsProps {
  disabled: boolean;
  canUndo: boolean;
  onJudge: (verdict: SwipeVerdict) => void;
  onUndo: () => void;
  /** Deux verdicts (cf. SwipeStack) : pas pour moi · annuler · j'aime —
   *  chaque verdict du côté où la carte part, annuler entre les deux. */
  binary?: boolean;
  /** Nom de la barre pour les lecteurs d'écran — « Affiner » par défaut. */
  label?: string;
}

interface ControlSpec {
  key: string;
  label: string;
  Icon: LucideIcon;
  size: "sm" | "lg";
  tone: string;
  onPress: () => void;
  disabled: boolean;
}

const BINARY_ORDER = ["dislike", "undo", "like"] as const;

/**
 * Les cinq gestes en boutons — l'alternative visible au glisser (jamais un
 * geste seul pour une action). Libellé visible sous chaque bouton dès 640 px
 * (sur téléphone : icônes seules, libellé lu par aria-label) ; les trois
 * verdicts sont larges (56 px), annuler et passer plus discrets (44 px).
 * Pas de verre ici : rien ne défile derrière, un flou ne servirait à rien.
 */
export const SwipeControls = memo(function SwipeControls({
  disabled, canUndo, onJudge, onUndo, binary = false, label: toolbarLabel,
}: SwipeControlsProps) {
  const { t } = useTranslation("swipe");
  const specs: ControlSpec[] = [
    { key: "undo", label: t("undoShort"), Icon: Undo2, size: "sm", tone: "text-content-secondary", onPress: onUndo, disabled: !canUndo },
    { key: "dislike", label: t("dislike"), Icon: X, size: "lg", tone: "text-rose-400", onPress: () => onJudge("dislike"), disabled },
    { key: "superlike", label: t("superlike"), Icon: Star, size: "lg", tone: "text-white", onPress: () => onJudge("superlike"), disabled },
    { key: "like", label: t("like"), Icon: Heart, size: "lg", tone: "text-emerald-400", onPress: () => onJudge("like"), disabled },
    { key: "skip", label: t("skip"), Icon: SkipForward, size: "sm", tone: "text-content-secondary", onPress: () => onJudge("skip"), disabled },
  ];
  const shown = binary ? BINARY_ORDER.map((key) => specs.find((s) => s.key === key)!) : specs;

  return (
    <div className="flex items-start justify-center gap-0.5 sm:gap-3" role="toolbar" aria-label={toolbarLabel ?? t("title")}>
      {shown.map(({ key, label, Icon, size, tone, onPress, disabled: off }) => {
        const lg = size === "lg";
        const brand = key === "superlike";
        return (
          <div key={key} className="flex w-16 flex-col items-center gap-1.5 sm:w-[4.75rem]">
            <button
              type="button"
              onClick={onPress}
              disabled={off}
              aria-label={key === "undo" ? t("undo") : label}
              title={key === "undo" ? t("undo") : label}
              className={`flex cursor-pointer items-center justify-center rounded-full border transition-[transform,opacity] duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line-focus ${
                lg ? "h-14 w-14" : "h-11 w-11"
              } ${
                brand
                  ? "border-transparent bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] shadow-lg"
                  : "border-line-subtle bg-surface-2 hover:bg-surface-3"
              } ${tone}`}
            >
              <Icon size={lg ? 26 : 20} strokeWidth={key === "dislike" ? 3 : 2.2} className={key === "like" || key === "superlike" ? "fill-current" : ""} aria-hidden />
            </button>
            {/* Sur téléphone, les icônes seules (le libellé reste lu : aria-label). */}
            <span className="hidden whitespace-nowrap text-center text-[0.72rem] font-medium leading-tight text-content-tertiary sm:block">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
});
