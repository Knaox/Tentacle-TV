import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { FauxCursor, Place, SceneStage, sceneTween, useSceneClock } from "..";

const STEPS = [700, 600, 300, 700, 300, 1500] as const;
const SEASONS = { x: 174, y: 110, w: 92, gap: 8 } as const;
const FIELD = { x: 174, y: 190, w: 292 } as const;
const TARGETS = [
  { x: SEASONS.x + SEASONS.w + SEASONS.gap + 46, y: SEASONS.y + 18 },
  { x: FIELD.x + 146, y: FIELD.y + 42 },
] as const;

/**
 * Les contours revenus : la saison choisie porte de nouveau sa bordure de
 * marque (le balisage de `EpisodeList`), et un champ de mot de passe qui
 * prend le focus s'entoure de son anneau (celui de la page de connexion).
 * Les deux calques se révèlent en opacité — jamais une bordure animée.
 */
export function OutlinesScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const season = step >= 2 ? 1 : 0;
  const focused = step >= 4;
  const target = step >= 3 ? TARGETS[1] : step >= 1 ? TARGETS[0] : { x: 560, y: 330 };
  return (
    <SceneStage cycle={cycle}>
      {[0, 1, 2].map((index) => (
        <Place key={index} x={SEASONS.x + index * (SEASONS.w + SEASONS.gap)} y={SEASONS.y} w={SEASONS.w}>
          <span className="relative flex h-9 items-center justify-center overflow-hidden rounded-lg bg-fill-subtle text-[12px] font-medium">
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-lg border border-[rgba(var(--brand-rgb),0.45)] bg-[var(--brand-soft)]"
              initial={false}
              animate={{ opacity: season === index ? 1 : 0 }}
              transition={sceneTween}
            />
            <span className={`relative ${season === index ? "text-[var(--brand-light)]" : "text-content-tertiary"}`}>
              {t("whatsNew:sceneSeason", { number: index + 1 })}
            </span>
          </span>
        </Place>
      ))}
      <Place x={FIELD.x} y={FIELD.y} w={FIELD.w}>
        <p className="mb-1.5 text-[11px] font-medium text-content-secondary">{t("auth:password")}</p>
        <div className="relative flex h-11 items-center rounded-lg border border-line-subtle bg-fill-subtle px-3">
          <motion.span
            aria-hidden
            className="absolute -inset-px rounded-lg border border-[var(--brand)] ring-2 ring-[rgba(var(--brand-rgb),0.3)]"
            initial={false}
            animate={{ opacity: focused ? 1 : 0 }}
            transition={sceneTween}
          />
          <motion.span
            className="relative text-[14px] tracking-[0.2em] text-content-primary"
            initial={false}
            animate={{ opacity: step >= 5 ? 1 : 0 }}
            transition={sceneTween}
          >
            ••••••••
          </motion.span>
        </div>
      </Place>
      <FauxCursor x={target.x} y={target.y} pressed={step === 2 || step === 4} hidden={step >= 5} reduced={reduced} />
    </SceneStage>
  );
}
