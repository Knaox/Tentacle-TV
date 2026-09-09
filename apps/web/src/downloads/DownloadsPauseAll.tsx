/**
 * « Tout mettre en pause » / « Tout reprendre » — un seul geste pour la file
 * entière, à côté du compte de ce qui tourne.
 *
 * Le téléphone l'a dans sa notification ET dans son écran de gestion ; le
 * bureau n'avait que le bouton de chaque ligne, à répéter vingt-quatre fois
 * pour une saison. Rendu seulement quand il y a quelque chose à suspendre ou à
 * relancer : une file au repos n'a pas besoin d'un bouton mort.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { pauseDownload, resumeDownload, type DownloadEntry } from "./api";

const RUNNING = new Set(["queued", "downloading"]);

export function DownloadsPauseAll({ entries }: { entries: readonly DownloadEntry[] }) {
  const { t } = useTranslation("downloads");
  const [busy, setBusy] = useState(false);

  const running = entries.filter((entry) => RUNNING.has(entry.status));
  // Une pause SYSTÈME (réseau coupé, Wi-Fi seulement) se relève d'elle-même :
  // seules les pauses explicites appellent un « Tout reprendre ».
  const held = entries.filter((entry) => entry.status === "paused" && entry.pausedByUser);
  if (running.length === 0 && held.length === 0) return null;

  const pausing = running.length > 0;
  // EN SÉRIE : chaque appel écrit dans la même base par IPC et le moteur
  // diffuse un `downloads://changed` à chacun — vingt-quatre écritures
  // concurrentes feraient vingt-quatre invalidations de liste.
  const apply = async (): Promise<void> => {
    setBusy(true);
    for (const entry of pausing ? running : held) {
      await (pausing ? pauseDownload(entry.id) : resumeDownload(entry.id));
    }
    setBusy(false);
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-fill-faint px-3 py-2.5">
      <span className="text-sm text-content-secondary">
        {t("activeCount", { count: pausing ? running.length : held.length })}
      </span>
      <button
        type="button"
        onClick={() => void apply()}
        disabled={busy}
        className="rounded-md bg-fill-subtle px-3 py-1.5 text-xs font-semibold text-content-secondary transition-colors duration-150 hover:bg-fill-soft hover:text-content-primary disabled:opacity-50"
      >
        {pausing ? t("pauseAll") : t("resumeAll")}
      </button>
    </div>
  );
}
