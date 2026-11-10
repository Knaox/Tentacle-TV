/**
 * Ce que la machine porte, sous la bannière de l'accueil local : combien de
 * titres, le dernier arrivé, la place qu'ils prennent sur le disque — une barre
 * à l'ENCRE (l'espace ne transfère rien) —, et les deux gestes qui s'y
 * rattachent : gérer les téléchargements, et repasser en ligne quand on est
 * hors ligne À LA MAIN alors que le serveur répond.
 *
 * Panneau opaque du socle (`.ui-panel`) : aucun `backdrop-filter` (rien de
 * vivant derrière), plus de halo de marque ; la barre en `scaleX`.
 */

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HardDriveIcon as HardDrive } from "@phosphor-icons/react/dist/csr/HardDrive";
import type { DownloadListEntry } from "@tentacle-tv/offline-core";
import { setManualOffline } from "../offline/connectivityStore";
import { useConnectivity } from "../offline/useConnectivity";
import { SlidersHorizontalIcon } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
import { SpaceMeter } from "./ui/SpaceMeter";
import { useDiskInfo } from "./useDownloadState";
import { GlassButton } from "../components/ui/glass/GlassButton";

export function OfflineDeviceSummary({ complete }: { complete: readonly DownloadListEntry[] }) {
  const { t } = useTranslation("downloads");
  const { usedBytes, freeBytes } = useDiskInfo();
  const { state, reachable } = useConnectivity();
  const backOnline = state === "offline-manual" && reachable === true;

  const last = complete.reduce<DownloadListEntry | null>(
    (best, entry) => (best === null || entry.createdAt > best.createdAt ? entry : best),
    null,
  );
  const lastName = last === null ? null : last.kind === "episode" ? last.seriesName ?? last.title : last.title;
  const parts = [
    t("deviceTitles", { count: complete.length }),
    lastName ? t("deviceLastAdded", { name: lastName }) : null,
  ].filter((part): part is string => part !== null && part !== "");

  return (
    <div className="row-gutter">
      <div className="ui-panel lg-panel flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-3.5">
          <span aria-hidden className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-pill bg-fill-soft text-content-secondary">
            <HardDrive size={20} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="font-display text-[18px] font-semibold leading-tight tracking-[-0.015em] text-content-primary">{t("heroLabel")}</h2>
            <p className="num truncate text-[13px] text-content-secondary">{parts.join(" · ")}</p>
          </div>
        </div>

        {usedBytes !== null && <SpaceMeter usedBytes={usedBytes} freeBytes={freeBytes} className="w-full sm:w-[260px]" />}

        <div className="flex flex-wrap items-center gap-2">
          {backOnline && (
            // Posé sur un panneau opaque : la peau peinte, jamais une lentille (lot lg7).
            <GlassButton
              inSurface
              onClick={() => setManualOffline(false)}
              appearance={{ level: "prominent", tint: "brand", shape: "capsule" }}
              className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap px-[13px] text-[13px] font-semibold"
              fallbackClassName="btn btn-solid btn-sm"
            >
              {t("offlineGoOnline")}
            </GlassButton>
          )}
          {/* « Gérer » est un geste du CONTENU : la pilule douce du socle ; en verre
              natif, un remplissage (`lg-content-control`, lot lg2). */}
          <Link to="/downloads" className="btn btn-soft btn-sm lg-content-control">
            <SlidersHorizontalIcon size={16} aria-hidden />
            {t("offlineManage")}
          </Link>
        </div>
      </div>
    </div>
  );
}
