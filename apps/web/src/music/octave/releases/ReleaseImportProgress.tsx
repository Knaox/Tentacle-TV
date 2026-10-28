/**
 * Octave — l'import EN COURS (ou en pause) : où il en est en une ligne, une barre (`transform: scaleX`, jamais
 * une largeur animée), puis chaque fichier avec son état en MOTS (jamais la seule couleur). En pause : ce qui est
 * déjà transféré est gardé, « Reprendre » repart de là. La boîte peut se fermer : l'import continue. L'album paraît
 * avec sa pochette DÈS que le serveur l'a lu (premier fichier d'un lot), sans attendre la fin.
 */

import { Check, CircleAlert, Copy, Loader2, PauseCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { releaseArrival, releaseFraction, type ReleaseFlowState } from "@tentacle-tv/api-client";
import { releaseArtSized } from "@tentacle-tv/shared/music";
import { Artwork } from "../components/Artwork";
import type { ReleaseJobFile } from "@tentacle-tv/shared/music";
import { formatBytes } from "./webReleaseFiles";

const BUTTON = "min-h-[44px] cursor-pointer rounded-full px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

function FileLine({ file, active }: { file: ReleaseJobFile; active: boolean }) {
  const { t } = useTranslation("musicReleases");
  const Icon = file.state === "read" ? Check : file.state === "duplicate" ? Copy : file.state === "refused" ? CircleAlert : active ? Loader2 : null;
  return (
    <li className={`flex items-center gap-2.5 text-sm ${active ? "text-content-primary" : "text-content-secondary"}`}>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {Icon ? <Icon className={`h-4 w-4 ${Icon === Loader2 ? "animate-spin motion-reduce:animate-none" : ""} ${file.state === "refused" ? "text-amber-300" : file.state === "read" ? "text-octave-accent-text" : ""}`} aria-hidden /> : <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1 truncate" title={file.name}>
        {file.name}
      </span>
      <span className={`shrink-0 text-xs ${file.state === "refused" ? "text-amber-300" : "text-content-tertiary"}`} title={file.refusal ? t(`refusal.${file.refusal}`) : undefined}>
        {t(`file.${file.state}`)}
      </span>
    </li>
  );
}

interface Props {
  titleId: string;
  state: ReleaseFlowState;
  onHide: () => void;
  onCancel: () => void;
  onResume: () => void;
}

export function ReleaseImportProgress({ titleId, state, onHide, onCancel, onResume }: Props) {
  const { t, i18n } = useTranslation("musicReleases");
  const files = state.job?.files ?? [];
  const fraction = releaseFraction(state.job, state.sentBytes, state.totalBytes);
  const paused = state.phase === "paused";
  const current = state.sending !== null ? files[state.sending] : null;
  const early = releaseArrival(state.job);
  const line =
    state.source === "bandcamp"
      ? t("linkReading")
      : current
        ? t("sendingFile", { name: current.name, index: (state.sending ?? 0) + 1, total: files.length })
        : state.totalBytes > 0
          ? t("bytes", { sent: formatBytes(state.sentBytes, i18n.language), total: formatBytes(state.totalBytes, i18n.language) })
          : "";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        {paused ? <PauseCircle className="h-6 w-6 shrink-0 text-amber-300" aria-hidden /> : <Loader2 className="h-6 w-6 shrink-0 animate-spin text-content-tertiary motion-reduce:animate-none" aria-hidden />}
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">
            {t(`phase.${state.phase}`)}
          </h2>
          <p className="truncate text-sm text-content-tertiary tabular-nums" aria-live="polite">
            {paused ? t("pausedHint") : line}
          </p>
        </div>
      </div>
      {early && (
        <div className="flex items-center gap-3">
          <Artwork url={early.artworkUrl ? releaseArtSized(early.artworkUrl, "300") : null} alt={early.title} label={early.title} radius="sm" className="h-14 w-14 shrink-0" eager />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-content-primary">{early.title}</p>
            <p className="truncate text-xs text-content-tertiary">{early.artists.map((a) => a.name).join(", ")}</p>
          </div>
        </div>
      )}
      <div className="h-1.5 overflow-hidden rounded-full bg-fill-subtle" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)} aria-labelledby={titleId}>
        <div className="octave-brand-fill h-full w-full origin-left transition-transform duration-300 ease-out motion-reduce:transition-none" style={{ transform: `scaleX(${fraction})` }} />
      </div>
      {files.length > 0 && (
        <ul className="flex max-h-[40vh] flex-col gap-2 overflow-y-auto pr-1">
          {files.map((file, i) => (
            <FileLine key={file.uploadId} file={file} active={i === state.sending} />
          ))}
        </ul>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={`${BUTTON} text-content-tertiary hover:text-content-primary`}>
          {t("cancel")}
        </button>
        {paused ? (
          <button type="button" autoFocus onClick={onResume} className={`${BUTTON} octave-brand-fill px-6`}>
            {t("resume")}
          </button>
        ) : (
          <button type="button" onClick={onHide} className={`${BUTTON} border border-line-subtle text-content-primary hover:bg-octave-hover`}>
            {t("hide")}
          </button>
        )}
      </div>
    </div>
  );
}
