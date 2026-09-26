import { useTranslation } from "react-i18next";
import { useEntered } from "./useEntered";
import { OverlayPill } from "./OverlayPill";

interface Props {
  label: string;
  onPress: () => void;
  /** Durée totale du décompte (ms) ; `null` = bouton manuel, sans balayage. */
  countdownTotalMs?: number | null;
  onDismiss?: () => void;
}

/**
 * LE bouton de saut (intro, résumé, aperçu, générique, « épisode suivant ») —
 * `SkipButton` de l'app : coin bas-droit, à `max(110, bas + 86)` du bas et
 * `max(20, droite + 16)` du bord ; entrée « Rising » (montée de 8, fondu,
 * 200 ms). Le dessin vit dans `OverlayPill`.
 */
export function SkipButton({ label, onPress, countdownTotalMs, onDismiss }: Props) {
  const { t } = useTranslation("player");
  const entered = useEntered();
  return (
    <div
      className="pointer-events-none absolute flex flex-col items-end transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
      style={{
        zIndex: 50,
        bottom: "max(110px, calc(env(safe-area-inset-bottom, 0px) + 86px))",
        right: "max(20px, calc(env(safe-area-inset-right, 0px) + 16px))",
        opacity: entered ? 1 : 0,
        transform: `translateY(${entered ? 0 : 8}px)`,
      }}
    >
      <OverlayPill
        label={label}
        onPress={onPress}
        countdownMs={countdownTotalMs}
        onDismiss={onDismiss}
        dismissLabel={t("dismiss")}
      />
    </div>
  );
}
