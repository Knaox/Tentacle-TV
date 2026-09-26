import { useTranslation } from "react-i18next";
import { useViewport } from "../../useFormFactor";
import { PLAYER } from "../playerColors";

/**
 * L'indicateur éphémère « −10 / +30 » après un saut (boutons ou double-tap) —
 * `SkipIndicator` de l'app : un rond de `min(72, 0,09 × H)` sur le voile, à
 * 38 % de la hauteur, écarté du bord de `max(8 % × W, encoche + 12)`.
 */
export function SkipIndicator({ side }: { side: "left" | "right" | null }) {
  const { t } = useTranslation("player");
  const { width, height } = useViewport();
  if (!side) return null;
  const size = Math.min(72, Math.round(height * 0.09));
  const inset = side === "left" ? "env(safe-area-inset-left, 0px)" : "env(safe-area-inset-right, 0px)";
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute flex flex-col items-center justify-center"
      style={{
        top: "38%",
        [side]: `max(${Math.round(width * 0.08)}px, calc(${inset} + 12px))`,
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: PLAYER.scrim,
      }}
    >
      <span style={{ color: PLAYER.text, fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>
        {side === "left" ? "-10" : "+30"}
      </span>
      <span style={{ color: PLAYER.textTertiary, fontSize: 11 }}>{t("secondsShort")}</span>
    </div>
  );
}
