import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { CircleCheck, KeyRound } from "lucide-react";
import type { SceneProps } from "../../types";
import { AdminNotice } from "../../../components/admin/kit";
import { FauxCursor, Place, SceneStage, sceneTween, useSceneClock } from "..";

const STEPS = [700, 700, 300, 900, 800, 1500] as const;
const LEFT = 24;
const W = 592;
/** « Tester la clé » : le premier bouton de la ligne de la clé. */
const TEST = { x: 392, y: 118 } as const;
const ACCOUNTS = 8;
/** Comptes traités, pas à pas : le calcul se suit en direct. */
const PROCESSED = [0, 0, 0, 3, 6, ACCOUNTS] as const;

const BUTTON = "inline-flex h-7 items-center rounded-lg border px-2.5 text-[10.5px] font-semibold";

/**
 * La page Métadonnées : la clé TMDB d'un regard, testée sans la ressortir —
 * TMDB l'accepte —, puis le calcul des recommandations suivi compte par
 * compte jusqu'au bout.
 */
export function AdminMetadataScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation("adminMetadata");
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const tested = step >= 3;
  const processed = PROCESSED[step] ?? 0;
  const running = step >= 3 && step < 5;
  const finished = step >= 5;
  return (
    <SceneStage cycle={cycle}>
      <Place x={LEFT} y={16} w={W}>
        <span className="block text-[15px] font-bold text-content-primary">{t("title")}</span>
      </Place>
      <Place x={LEFT} y={46} w={W}>
        <div className="space-y-3 rounded-2xl border border-line-subtle bg-fill-faint p-4">
          <div>
            <p className="text-[12px] font-semibold text-content-primary">{t("tmdbTitle")}</p>
            <p className="truncate text-[10.5px] text-content-tertiary">{t("tmdbDescription")}</p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-line-subtle bg-fill-faint px-3 py-2.5">
            <KeyRound aria-hidden className="h-4 w-4 shrink-0 text-content-tertiary" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-content-tertiary">
                <span className="font-medium">{t("keySaved")}</span> · {t("keySourceDb")}
              </p>
              <p className="font-mono text-[12px] tracking-wider text-content-primary">•••• •••• 3f9a</p>
            </div>
            <span className={`${BUTTON} border-line-subtle bg-fill-soft text-content-primary`}>{t("testSaved")}</span>
            <span className={`${BUTTON} border-line-subtle bg-fill-soft text-content-primary`}>{t("replace")}</span>
            <span className={`${BUTTON} border-danger-border bg-[var(--status-error-bg)] text-[var(--status-error-fg)]`}>{t("remove")}</span>
          </div>
          <motion.div initial={false} animate={{ opacity: tested ? 1 : 0 }} transition={sceneTween}>
            <AdminNotice tone="success" className="!px-3 !py-2 !text-[10.5px]">{t("testValidSaved")}</AdminNotice>
          </motion.div>
        </div>
      </Place>
      <Place x={LEFT} y={246} w={W} visible={step >= 3} dy={step >= 3 ? 0 : 8}>
        <div className="space-y-2 rounded-lg border border-line-subtle bg-fill-faint p-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 font-medium text-content-primary">
              {finished && <CircleCheck aria-hidden className="h-3.5 w-3.5 text-status-success-fg" />}
              {t("fanoutTitle")}
            </span>
            <span className="tabular-nums text-content-tertiary">
              {t("fanoutProgress", { count: ACCOUNTS, processed })}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-fill-soft">
            <motion.div
              className="h-full w-full origin-left rounded-full bg-brand"
              initial={false}
              animate={{ scaleX: processed / ACCOUNTS }}
              transition={sceneTween}
            />
          </div>
          <p className="truncate text-[10px] text-content-tertiary">
            {running ? t("fanoutRunningHint") : t("fanoutDone", { count: ACCOUNTS, when: t("justNow") })}
          </p>
        </div>
      </Place>
      <FauxCursor x={step >= 1 ? TEST.x : 560} y={step >= 1 ? TEST.y : 340} pressed={step === 2} hidden={step >= 4} reduced={reduced} />
    </SceneStage>
  );
}
