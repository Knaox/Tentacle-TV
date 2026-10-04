import { useTranslation } from "react-i18next";
import { Check, Settings } from "lucide-react";
import type { SceneProps } from "../../types";
import { NoticeCard } from "../../../components/notices/NoticeCard";
import { FauxCursor, Place, ScenePlayerPanel, SceneStage, useSceneClock } from "..";

/** La lecture, la carte « Qualité réduite », puis le menu Qualité où la raison se relit. */
const STEPS = [1400, 2600, 900, 2200] as const;
const PANEL = { x: 90, y: 30, w: 460 };
const GEAR = { x: PANEL.x + PANEL.w - 28, y: PANEL.y + PANEL.w * (9 / 16) - 60 };
const noop = () => {};

/**
 * « Qualité réduite » : quand la qualité baisse en Auto, le lecteur dit
 * POURQUOI — ici le réseau mesuré, l'une des trois raisons de la règle
 * partagée (réseau, limite Internet de Jellyfin, conversion par le serveur).
 * La vraie carte des avertissements du lecteur, posée sur la vraie image du
 * titre du bandeau ; puis le menu Qualité, où la même raison se relit sous
 * « Auto ».
 */
export function QualityDropScene({ active, reduced }: SceneProps) {
  const { t, i18n } = useTranslation(["player", "whatsNew"]);
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const values = {
    measured: (6.2).toLocaleString(i18n.language),
    source: (18).toLocaleString(i18n.language),
  };
  const menuOpen = step === 3;

  return (
    <SceneStage cycle={cycle}>
      <ScenePlayerPanel x={PANEL.x} y={PANEL.y} w={PANEL.w} progress={0.34} caption="1:12:40" />
      <Place x={PANEL.x + 70} y={PANEL.y + 22} w={PANEL.w - 140} visible={step === 1} dy={step === 1 ? 0 : -10}>
        <NoticeCard
          surface="player"
          severity="info"
          icon="gauge"
          title={t("player:qualityDropTitle")}
          lines={[t("player:qualityDrop.network", values)]}
          onClose={noop}
          countdown={null}
          durationMs={null}
        />
      </Place>
      <Place x={GEAR.x - 12} y={GEAR.y - 12} w={24} h={24}>
        <span className="grid h-6 w-6 place-items-center rounded-full bg-black/50 text-white">
          <Settings size={13} aria-hidden="true" />
        </span>
      </Place>
      <Place x={PANEL.x + PANEL.w - 250} y={PANEL.y + 14} w={230} visible={menuOpen} dy={menuOpen ? 0 : 8}>
        <div className="rounded-xl border border-white/15 bg-[rgba(12,10,20,0.94)] p-1.5 text-white shadow-xl">
          <div className="flex items-start gap-2 rounded-lg bg-white/10 px-2.5 py-2">
            <Check size={13} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-[var(--brand-light)]" />
            <div className="min-w-0">
              <p className="text-[12px] font-semibold">{t("player:qualityAutoBadge")}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-white/70">{t("player:qualityDropMenu.network", values)}</p>
            </div>
          </div>
          {["1080p", "720p", "540p"].map((label) => (
            <p key={label} className="px-2.5 py-1.5 pl-[30px] text-[12px] text-white/85">{label}</p>
          ))}
        </div>
      </Place>
      <FauxCursor x={GEAR.x} y={GEAR.y} pressed={step === 2} hidden={step < 2} reduced={reduced} />
    </SceneStage>
  );
}
