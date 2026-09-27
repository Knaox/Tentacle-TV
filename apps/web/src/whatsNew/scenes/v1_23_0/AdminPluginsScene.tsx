import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import type { SceneProps } from "../../types";
import { AdminNotice } from "../../../components/admin/kit";
import { FauxCursor, Place, SceneStage, sceneTween, useSceneClock } from "..";
import { FauxMarketplaceCard, VIGIE, type InstallPhase } from "./FauxMarketplaceCard";

const STEPS = [700, 700, 300, 700, 1000, 900, 1500] as const;
const CARD = { x: 24, y: 112, w: 300, h: 230 } as const;
const NOTICE = { x: 340, y: 112, w: 276 } as const;
/** « Installer », en bas à gauche de la carte. */
const INSTALL = { x: CARD.x + 60, y: CARD.y + CARD.h - 30 } as const;
/** L'avancement du redémarrage, pas à pas : le serveur tombe, puis revient. */
const PROGRESS = [0, 0, 0, 0, 0.35, 0.8, 1] as const;

/**
 * Le marketplace : la fiche de Vigie, « Installer ». Son module serveur
 * impose un redémarrage : il est annoncé, suivi, puis confirmé — sans
 * recharger la page.
 */
export function AdminPluginsScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation("adminPlugins");
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const phase: InstallPhase = step >= 6 ? "installed" : step >= 2 ? "installing" : "idle";
  const restarting = step >= 4 && step < 6;
  const done = step >= 6;
  const tabs = [t("tabInstalled"), t("tabMarketplace"), t("tabSources")];
  return (
    <SceneStage cycle={cycle}>
      <Place x={24} y={16} w={592}>
        <span className="block text-[15px] font-bold text-content-primary">{t("admin:navPlugins")}</span>
        <div className="mt-2 flex gap-4 border-b border-line-subtle text-[11px] font-medium">
          {tabs.map((label, index) => (
            <span
              key={label}
              className={`-mb-px border-b-2 pb-1.5 ${index === 1 ? "border-[var(--brand)] text-content-primary" : "border-transparent text-content-tertiary"}`}
            >
              {label}
            </span>
          ))}
        </div>
      </Place>
      <Place x={24} y={78} w={260}>
        <div className="flex h-7 items-center gap-2 rounded-lg border border-line-subtle bg-fill-subtle px-2.5 text-[10.5px] text-content-quaternary">
          <Search aria-hidden className="h-3.5 w-3.5" />
          {t("searchPlaceholder")}
        </div>
      </Place>
      <FauxMarketplaceCard {...CARD} phase={phase} />
      <Place x={NOTICE.x} y={NOTICE.y} w={NOTICE.w} visible={restarting} dy={restarting ? 0 : 8}>
        <AdminNotice tone="info" title={t("restartingFor", { name: VIGIE.name })} className="!px-3 !py-2.5 !text-[10.5px]">
          <p>{t("restartingBody")}</p>
          <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-fill-soft">
            <motion.div
              className="h-full w-full origin-left rounded-full bg-brand"
              initial={false}
              animate={{ scaleX: PROGRESS[step] ?? 0 }}
              transition={sceneTween}
            />
          </div>
        </AdminNotice>
      </Place>
      <Place x={NOTICE.x} y={NOTICE.y} w={NOTICE.w} visible={done} dy={done ? 0 : 8}>
        <AdminNotice tone="success" title={t("restartDone")} className="!px-3 !py-2.5 !text-[10.5px]">
          {t("restartDoneBody")}
        </AdminNotice>
      </Place>
      <FauxCursor x={step >= 1 ? INSTALL.x : 560} y={step >= 1 ? INSTALL.y : 340} pressed={step === 2} hidden={step >= 4} reduced={reduced} />
    </SceneStage>
  );
}
