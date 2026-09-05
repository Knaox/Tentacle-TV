import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { FauxChip, FauxCursor, Place, SceneStage, useSceneClock } from "..";

const STEPS = [900, 700, 1000, 1500] as const;
const COLS = [32, 200, 368] as const;
const CARD_STEP = 90;

function TicketCard({ x, y, dx = 0, dy = 0, lifted = false, label }: { x: number; y: number; dx?: number; dy?: number; lifted?: boolean; label: string }) {
  return (
    <Place x={x} y={y} w={134} h={70} dx={dx} dy={dy} scale={lifted ? 1.05 : 1} className="rounded-[var(--radius-md)] border border-line-subtle bg-surface-2 p-2.5">
      <span className="block truncate text-[11px] font-semibold text-content-primary">{label}</span>
      <span className="mt-1.5 block h-1.5 w-3/4 rounded-sm bg-fill-medium" />
      <span className="mt-1 block h-1.5 w-1/2 rounded-sm bg-fill-soft" />
    </Place>
  );
}

/** Une carte glisse d'« Ouverts » à « En cours », le volet latéral s'ouvre. */
export function TicketsBoardScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const grabbed = step >= 1;
  const moved = step >= 2;
  const panel = step >= 3;
  const titles = [t("tickets:open"), t("tickets:inProgress"), t("tickets:resolved")];
  return (
    <SceneStage cycle={cycle}>
      {COLS.map((x, i) => (
        <Place key={x} x={x} y={28} w={150} h={304} className="rounded-[var(--radius-lg)] bg-fill-subtle" dx={panel ? -40 : 0}>
          <span className="absolute left-3 top-3 text-[12px] font-semibold text-content-secondary">{titles[i]}</span>
        </Place>
      ))}
      <TicketCard x={COLS[1] + 8} y={70} label={t("whatsNew:sceneTicketAudio")} dx={panel ? -40 : 0} />
      <TicketCard x={COLS[2] + 8} y={70} label={t("whatsNew:sceneTicketPoster")} dx={panel ? -40 : 0} />
      <TicketCard x={COLS[0] + 8} y={70 + CARD_STEP} label={t("whatsNew:sceneTicketLogin")} dx={panel ? -40 : 0} dy={moved ? -CARD_STEP : 0} />
      <TicketCard
        x={COLS[0] + 8}
        y={70}
        label={t("whatsNew:sceneTicketSubtitles")}
        lifted={grabbed && !panel}
        dx={(moved ? COLS[1] - COLS[0] : 0) + (panel ? -40 : 0)}
        dy={moved ? CARD_STEP : 0}
      />
      <Place x={520} y={28} w={110} h={304} visible={panel} dx={panel ? 0 : 130} className="rounded-[var(--radius-lg)] border border-line-subtle bg-surface-2 p-3">
        <span className="block text-[11px] font-semibold text-content-primary">{t("whatsNew:sceneTicketSubtitles")}</span>
        <FauxChip x={12} y={40} label={t("tickets:statusInProgress")} size="sm" selected />
        <span className="absolute left-3 top-80 block h-1.5 w-3/4 rounded-sm bg-fill-medium" />
      </Place>
      <FauxCursor
        x={grabbed ? (moved ? COLS[1] + 70 : COLS[0] + 70) : 560}
        y={grabbed ? (moved ? 70 + CARD_STEP + 30 : 100) : 330}
        pressed={grabbed && !panel}
        hidden={panel}
        reduced={reduced}
      />
    </SceneStage>
  );
}
