import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { FauxCard, FauxChip, Place, SceneStage, sceneSpring, useSceneClock } from "..";

const STEPS = [900, 900, 1000, 1500] as const;
const BARS = [40, 70, 100, 130, 160] as const;

/** Le débit chute, la qualité descend d'un palier avec son badge Auto, un mot discret le dit. */
export function AutoQualityScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const dropped = step >= 1;
  const adapted = step >= 2;
  return (
    <SceneStage cycle={cycle}>
      <FauxCard variant="panel" x={40} y={40} w={380} tone={1} progress={0.4} />
      <FauxChip x={346} y={52} label={t("player:quality1080p")} visible={!adapted} />
      <FauxChip x={318} y={52} label={`${t("player:qualityAutoBadge")} · ${t("player:quality720p")}`} selected visible={adapted} />
      <Place x={466} y={70} w={150} h={16}>
        <span className="text-[11px] font-medium text-content-tertiary">{t("whatsNew:sceneBandwidth")}</span>
      </Place>
      {BARS.map((h, i) => {
        const collapse = i >= 3 ? 0.15 : i === 2 ? 0.5 : 1;
        return (
          <motion.div
            key={i}
            className="absolute origin-bottom rounded-sm bg-gradient-to-t from-[var(--brand)] to-[var(--brand-accent)]"
            style={{ left: 470 + i * 26, top: 260 - h, width: 18, height: h }}
            initial={false}
            animate={{ scaleY: dropped ? collapse : 1, opacity: dropped && i >= 2 ? 0.55 : 1 }}
            transition={sceneSpring}
          />
        );
      })}
      <FauxChip x={60} y={292} label={t("player:qualityReduced")} icon="check" visible={step >= 3} dy={step >= 3 ? 0 : 8} />
    </SceneStage>
  );
}
