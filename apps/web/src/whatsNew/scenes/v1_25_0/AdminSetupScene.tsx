import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { SetupCheckRow } from "../../../components/admin/jellyfin/SetupCheckRow";
import { languageChoice } from "../../../components/admin/jellyfin/setupPresentation";
import { FauxCursor, Place, SceneStage, useSceneClock } from "..";
import { sceneSetupChecks } from "./adminSceneData";
import { Shrink } from "./Shrink";

const STEPS = [1300, 800, 500, 1100, 2000] as const;
const PANEL = { x: 40, y: 20, w: 560, scale: 0.56 } as const;
/** Le bouton « Activer sur 2 bibliothèques » de la ligne des aperçus, en px du canevas. */
const APPLY = { x: 137, y: 236 } as const;
const DASHBOARD = "http://jellyfin.local:8096";
const noop = () => {};

/**
 * Les réglages recommandés pour Jellyfin : l'état RÉEL de chacun, et le geste
 * en un clic quand il est sûr. Le curseur active les aperçus de la barre de
 * lecture sur les bibliothèques qui ne les avaient pas : la ligne passe à
 * « Fait ». Les VRAIES lignes (`SetupCheckRow`), sur des données factices —
 * sans la ligne des bandes-annonces, dont le texte parle d'une extension.
 */
export function AdminSetupScene({ active, reduced }: SceneProps) {
  const { t, i18n } = useTranslation("adminJellyfin");
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const done = step >= 3;
  const checks = useMemo(() => sceneSetupChecks(done), [done]);
  const language = useMemo(() => languageChoice(i18n.language, i18n.language === "fr" ? "fr-FR" : "en-US"), [i18n.language]);
  const doneCount = checks.filter((c) => c.state === "done").length;
  return (
    <SceneStage cycle={cycle}>
      <Place x={PANEL.x} y={PANEL.y} w={PANEL.w}>
        <div className="overflow-hidden rounded-2xl bg-[color:var(--surface-1)] ring-1 ring-line-subtle">
          <div className="flex items-start justify-between gap-4 px-4 pb-1 pt-3">
            <p className="text-[13px] font-semibold text-content-primary">{t("setupTitle")}</p>
            <span className="shrink-0 text-[10px] font-medium tabular-nums text-content-secondary">
              {t("setupProgress", { done: doneCount, total: checks.length })}
            </span>
          </div>
          <Shrink width={PANEL.w} scale={PANEL.scale}>
            <ul className="divide-y divide-line-subtle">
              {checks.map((check) => (
                <SetupCheckRow
                  key={check.id}
                  check={check}
                  dashboardUrl={DASHBOARD}
                  jellyfinVersion="10.11.8"
                  language={language}
                  running={step === 2 ? "enableTrickplay" : null}
                  failed={null}
                  onApply={noop}
                />
              ))}
            </ul>
          </Shrink>
        </div>
      </Place>
      <FauxCursor x={APPLY.x} y={APPLY.y} pressed={step === 2} hidden={step === 0 || step >= 4} reduced={reduced} />
    </SceneStage>
  );
}
