import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Clapperboard, Database, HardDriveDownload, LifeBuoy, Mail, MonitorPlay, Puzzle, Users } from "lucide-react";
import type { SceneProps } from "../../types";
import { StatusPill } from "../../../components/admin/kit";
import { useAdminSections } from "../../../components/admin/adminSections";
import { FauxCursor, Place, SceneStage, useSceneClock } from "..";
import { FauxAdminRail, railRowCenter } from "./FauxAdminRail";
import { FauxStatTile } from "./FauxStatTile";

const STEPS = [700, 900, 1000, 1000, 1400] as const;
const CONTENT = { x: 182, w: 442 } as const;
const TILE_W = 142;
const TILE_H = 98;
const COLS = [CONTENT.x, CONTENT.x + TILE_W + 8, CONTENT.x + 2 * (TILE_W + 8)] as const;
const ROWS = [146, 250] as const;
/** La tuile des tickets : la première qui demande de l'attention. */
const TICKETS = { x: COLS[1] + 90, y: ROWS[0] + 60 } as const;

/**
 * La vue d'ensemble : l'administration s'ouvre sur l'état du serveur et six
 * tuiles, dans un rail rangé en trois groupes. Les chiffres arrivent, le
 * curseur survole la tuile des tickets (ambre : elle attend quelqu'un), puis
 * le rail.
 */
export function AdminOverviewScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation("admin");
  const sections = useAdminSections();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const loading = step === 0;
  const onTile = step === 2;
  const onRail = step >= 3;
  const plugins = railRowCenter(sections, "plugins");
  const cursor = onRail ? plugins : onTile ? TICKETS : { x: 560, y: 340 };
  return (
    <SceneStage cycle={cycle}>
      <FauxAdminRail activeId="overview" hoveredId={onRail ? "plugins" : undefined} />
      <Place x={CONTENT.x} y={12} w={CONTENT.w}>
        <p className="text-[15px] font-bold text-content-primary">{t("navOverview")}</p>
        <p className="truncate text-[10.5px] text-content-tertiary">{t("overviewDescription")}</p>
      </Place>
      <Place x={CONTENT.x} y={52} w={CONTENT.w}>
        <div className="rounded-xl border border-line-subtle bg-fill-faint p-2.5">
          <p className="mb-1.5 text-[11px] font-semibold text-content-primary">{t("homeHealthTitle")}</p>
          <div className="grid grid-cols-2 gap-2">
            <HealthRow icon={<Clapperboard />} name={t("homeJellyfin")} loading={loading} />
            <HealthRow icon={<Database />} name={t("homeDatabase")} loading={loading} />
          </div>
        </div>
      </Place>
      <FauxStatTile x={COLS[0]} y={ROWS[0]} w={TILE_W} h={TILE_H} loading={loading} icon={<MonitorPlay />} tone="brand"
        label={t("homeSessionsLabel")} value={3} hint={t("homeSessionsGroups", { count: 1 })} />
      <FauxStatTile x={COLS[1]} y={ROWS[0]} w={TILE_W} h={TILE_H} loading={loading} icon={<LifeBuoy />} tone="warning"
        label={t("homeTicketsLabel")} value={2} hint={t("homeTicketsInProgress", { count: 1 })} hovered={onTile} />
      <FauxStatTile x={COLS[2]} y={ROWS[0]} w={TILE_W} h={TILE_H} loading={loading} icon={<Puzzle />} tone="warning"
        label={t("homePluginsLabel")} value={1} hint={t("homePluginsInstalled", { count: 2 })} />
      <FauxStatTile x={COLS[0]} y={ROWS[1]} w={TILE_W} h={TILE_H} loading={loading} icon={<Users />}
        label={t("homeAccountsLabel")} value={8} hint={t("homeAccountsAdmins", { count: 1 })} />
      <FauxStatTile x={COLS[1]} y={ROWS[1]} w={TILE_W} h={TILE_H} loading={loading} icon={<Mail />}
        label={t("homeInvitesLabel")} value={1} hint={t("homeInvitesSeats", { count: 4 })} />
      <FauxStatTile x={COLS[2]} y={ROWS[1]} w={TILE_W} h={TILE_H} loading={loading} icon={<HardDriveDownload />}
        label={t("homeDownloadsLabel")} value={5} hint={t("homeDownloadsOf", { count: 8 })} />
      <FauxCursor x={cursor.x} y={cursor.y} reduced={reduced} hidden={step === 0} />
    </SceneStage>
  );
}

function HealthRow({ icon, name, loading }: { icon: ReactNode; name: string; loading: boolean }) {
  const { t } = useTranslation("admin");
  return (
    <div className="flex items-center gap-2 rounded-lg bg-fill-subtle px-2 py-1.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-fill-soft text-content-secondary [&>svg]:h-3.5 [&>svg]:w-3.5">
        {icon}
      </span>
      {/* La puce sous le nom, comme la vraie carte : à côté, elle tronquait « Base de données ». */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-content-primary">{name}</p>
        {loading ? (
          <span className="mt-1 block h-4 w-16 rounded-full bg-fill-soft" />
        ) : (
          <StatusPill tone="success" size="sm" className="mt-1 !h-4 !text-[9.5px]">{t("homeStateConnected")}</StatusPill>
        )}
      </div>
    </div>
  );
}
