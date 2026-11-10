/**
 * Les gestes sur la file entière : « Tout mettre en pause » / « Tout
 * reprendre », et « Tout réessayer » quand des transferts ont échoué.
 *
 * Le téléphone a la pause globale dans sa notification ET dans son écran de
 * gestion ; le bureau n'avait que le bouton de chaque ligne, à répéter
 * vingt-quatre fois pour une saison. Rendus seulement quand il y a quelque
 * chose à faire : une file au repos n'a pas besoin d'un bouton mort.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PauseIcon as Pause, PlayIcon as Play } from "../components/icons/transport";
import { ArrowClockwiseIcon as RotateCw } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { pauseDownload, resumeDownload, type DownloadEntry } from "./api";

const RUNNING = new Set(["queued", "downloading"]);

export function DownloadsQueueActions({ entries }: { entries: readonly DownloadEntry[] }) {
  const { t } = useTranslation("downloads");
  const [busy, setBusy] = useState(false);

  const running = entries.filter((entry) => RUNNING.has(entry.status));
  // Une pause SYSTÈME (réseau coupé, Wi-Fi seulement) se relève d'elle-même :
  // seules les pauses explicites appellent un « Tout reprendre ».
  const held = entries.filter((entry) => entry.status === "paused" && entry.pausedByUser);
  const failed = entries.filter((entry) => entry.status === "error");
  if (running.length === 0 && held.length === 0 && failed.length === 0) return null;

  // EN SÉRIE : chaque appel écrit dans la même base par IPC et le moteur
  // diffuse un `downloads://changed` à chacun — vingt-quatre écritures
  // concurrentes feraient vingt-quatre invalidations de liste.
  const apply = async (targets: readonly DownloadEntry[], gesture: (id: number) => Promise<void>): Promise<void> => {
    setBusy(true);
    for (const entry of targets) await gesture(entry.id);
    setBusy(false);
  };

  const pausing = running.length > 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(running.length > 0 || held.length > 0) && (
        <QueueButton
          label={pausing ? t("pauseAll") : t("resumeAll")}
          icon={pausing ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
          disabled={busy}
          onClick={() => void apply(pausing ? running : held, pausing ? pauseDownload : resumeDownload)}
        />
      )}
      {failed.length > 0 && (
        <QueueButton
          label={t("retryAll")}
          icon={<RotateCw className="h-3.5 w-3.5" aria-hidden />}
          disabled={busy}
          onClick={() => void apply(failed, resumeDownload)}
        />
      )}
    </div>
  );
}

function QueueButton({ label, icon, disabled, onClick }: { label: string; icon: React.ReactNode; disabled: boolean; onClick: () => void }) {
  return (
    // Un geste du CONTENU : la pilule douce du socle ; en verre natif, un remplissage (lot lg2).
    <button type="button" onClick={onClick} disabled={disabled} className="btn btn-soft btn-sm lg-content-control">
      {icon}
      {label}
    </button>
  );
}
