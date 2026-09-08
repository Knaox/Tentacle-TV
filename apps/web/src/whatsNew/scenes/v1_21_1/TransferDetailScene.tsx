import { useTranslation } from "react-i18next";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import type { SceneProps } from "../../types";
import { Place, SceneStage, useSceneClock } from "..";

const STEPS = [900, 900, 900, 1800] as const;
/** Ce que la ligne annonce à chaque pas : elle ne reste jamais muette. */
const PROGRESS = [12, 46, 100, 100] as const;

/** Une ligne de transfert qui dit tout : étape, débit, temps restant, pourcentage. */
export function TransferDetailScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const media = useSceneMedia();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const poster = posterAt(media, 0);
  const percent = PROGRESS[step] ?? 0;
  const finalizing = step >= 3;
  // À 100 %, plus rien ne coule : annoncer encore un débit serait faux.
  const running = percent < 100;
  const done = Math.round((557 * percent) / 100);
  return (
    <SceneStage cycle={cycle}>
      <Place x={68} y={104} w={504} className="rounded-xl border border-line-subtle bg-fill-faint p-4">
        <div className="flex items-center gap-3">
          <span className="h-20 w-14 flex-shrink-0 overflow-hidden rounded-md bg-surface-2">
            {poster?.url && <img src={poster.url} alt="" className="h-full w-full object-cover" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-[13px] font-semibold text-content-primary">
                {poster?.title ?? "Fullmetal Alchemist: Brotherhood"}
              </span>
              <span
                className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  finalizing ? "bg-status-warning-bg text-status-warning-fg" : "bg-status-info-bg text-status-info-fg"
                }`}
              >
                {finalizing ? t("downloads:statusFinalizing") : t("downloads:statusDownloading")}
              </span>
            </span>
            <span className="mt-0.5 block text-[11px] text-content-quaternary">
              {t("downloads:variantOriginal")} · 557 Mio
            </span>
            <span className="mt-2 flex items-center gap-2">
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-fill-soft">
                <span
                  className="block h-full rounded-full bg-brand transition-[width] duration-500"
                  style={{ width: `${percent}%` }}
                />
              </span>
              <span className="w-36 flex-shrink-0 whitespace-nowrap text-right text-[10px] tabular-nums text-content-quaternary">
                {done} Mio / 557 Mio{running ? ` · ${percent} %` : ""}
              </span>
            </span>
            <span className="mt-1 block text-[10px] tabular-nums text-content-quaternary">
              {running ? `${t("downloads:transferRate", { rate: "31 Mio" })} · ${t("downloads:timeLeftSeconds")}` : ""}
            </span>
          </span>
        </div>
      </Place>
    </SceneStage>
  );
}
