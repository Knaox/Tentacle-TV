import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { FauxCursor, Place, ScenePlayerPanel, SceneStage, sceneSpring, useSceneClock } from "..";

const STEPS = [900, 900, 1000, 1500] as const;
const BARS = [26, 44, 62, 80, 98] as const;

/** Une ligne du sélecteur de qualité du lecteur (TrackSelector), telle quelle. */
function QualityRow({ label, suffix, active, auto }: { label: string; suffix?: string; active: boolean; auto?: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
        active ? "bg-[rgba(var(--brand-rgb),0.25)] font-medium text-content-primary" : "text-content-tertiary"
      }`}
    >
      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${active ? "bg-tentacle-accent shadow-[0_0_6px_rgba(var(--brand-rgb),0.6)]" : "bg-fill-medium"}`} />
      <span className="flex flex-1 items-center gap-1.5 overflow-hidden">
        <span className="truncate">{label}</span>
        {auto && (
          <span className="flex-shrink-0 rounded bg-[rgba(var(--brand-rgb),0.2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--brand-light)]">
            {t("player:qualityAutoBadge")}
          </span>
        )}
        {suffix && <span className="text-content-quaternary">— {suffix}</span>}
      </span>
    </span>
  );
}

/** Le débit chute, la qualité descend d'un palier dans le vrai sélecteur, badge Auto, et un mot discret le dit. */
export function AutoQualityScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const dropped = step >= 1;
  const adapted = step >= 2;
  return (
    <SceneStage cycle={cycle}>
      <ScenePlayerPanel x={24} y={24} w={384} progress={0.4} />
      <Place x={424} y={24} w={192} className="rounded-xl border border-line-subtle bg-surface-modal p-1.5 shadow-2xl">
        <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-content-quaternary">{t("player:quality")}</p>
        <QualityRow label={t("player:original")} suffix="4K" active={false} />
        <QualityRow label={t("player:quality1080p")} active={!adapted} />
        <QualityRow label={t("player:quality720p")} active={adapted} auto={adapted} />
      </Place>
      <Place x={424} y={178} w={192} h={16}>
        <span className="text-[11px] font-medium text-content-tertiary">{t("whatsNew:sceneBandwidth")}</span>
      </Place>
      {BARS.map((h, i) => {
        const collapse = i >= 3 ? 0.15 : i === 2 ? 0.5 : 1;
        return (
          <motion.div
            key={i}
            className="absolute origin-bottom rounded-sm bg-gradient-to-t from-[var(--brand)] to-[var(--brand-accent)]"
            style={{ left: 428 + i * 24, top: 300 - h, width: 16, height: h }}
            initial={false}
            animate={{ scaleY: dropped ? collapse : 1, opacity: dropped && i >= 2 ? 0.55 : 1 }}
            transition={sceneSpring}
          />
        );
      })}
      <Place x={24} y={262} visible={step >= 3} dy={step >= 3 ? 0 : 8} className="rounded-xl border border-line-subtle bg-surface-modal px-3.5 py-2.5 shadow-2xl">
        <span className="text-xs text-content-primary">{t("player:qualityReduced")}</span>
      </Place>
      <FauxCursor x={560} y={330} hidden reduced={reduced} />
    </SceneStage>
  );
}
