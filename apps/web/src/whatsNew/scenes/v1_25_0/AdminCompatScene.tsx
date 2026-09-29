import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { InstalledColumn, LatestColumn } from "../../../components/admin/jellyfin/CompatColumns";
import { Place, SceneStage, sceneTween, useSceneClock } from "..";
import { SCENE_COMPAT_REPORT } from "./adminSceneData";
import { Shrink } from "./Shrink";

const STEPS = [1100, 1300, 2400] as const;
const PANEL = { x: 30, y: 62, w: 580, scale: 0.8 } as const;

/**
 * La compatibilité de Jellyfin, dans la vue d'ensemble : la version installée,
 * puis la dernière publiée — chacune jugée d'après les tests de Tentacle, avec
 * ce que les sondes ont confirmé sur CE serveur. Les VRAIES colonnes
 * (`InstalledColumn`, `LatestColumn`), sur un rapport factice.
 */
export function AdminCompatScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation("adminJellyfin");
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  return (
    <SceneStage cycle={cycle}>
      <Place x={PANEL.x} y={PANEL.y} w={PANEL.w}>
        <div className="rounded-2xl bg-[color:var(--surface-1)] p-4 ring-1 ring-line-subtle">
          <p className="text-[14px] font-semibold text-content-primary">{t("compatTitle")}</p>
          <p className="mt-0.5 text-[10px] leading-snug text-content-tertiary">{t("compatDescription")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <Shrink width={(PANEL.w - 32 - 10) / 2} scale={PANEL.scale}>
              <InstalledColumn report={SCENE_COMPAT_REPORT} />
            </Shrink>
            <motion.div initial={false} animate={{ opacity: step >= 1 ? 1 : 0, y: step >= 1 ? 0 : 8 }} transition={sceneTween}>
              <Shrink width={(PANEL.w - 32 - 10) / 2} scale={PANEL.scale}>
                <LatestColumn report={SCENE_COMPAT_REPORT} />
              </Shrink>
            </motion.div>
          </div>
        </div>
      </Place>
    </SceneStage>
  );
}
