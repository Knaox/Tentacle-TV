/**
 * Octave — où en est l'import d'un album ou de fichiers vers une playlist : l'envoi des fichiers (la vue de la
 * chaîne des sorties : fichier par fichier, pause et « Reprendre »), puis l'ajout des titres, puis la fin — ce qui
 * est entré, ce qui arrive encore dans la bibliothèque, ce qui a été refusé — et « Ouvrir la playlist ».
 */

import { CircleAlert, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ImportIntoState, ReleaseFlowState } from "@tentacle-tv/api-client";
import { ReleaseImportProgress } from "../../releases/ReleaseImportProgress";

const BUTTON = "min-h-[44px] cursor-pointer rounded-full px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

interface Props {
  titleId: string;
  state: ImportIntoState;
  release: ReleaseFlowState | null;
  onHide: () => void;
  onCancel: () => void;
  onResume: () => void;
  onOpen: (playlistId: string) => void;
  onRetry: () => void;
  onClose: () => void;
}

export function ImportIntoStatus({ titleId, state, release, onHide, onCancel, onResume, onOpen, onRetry, onClose }: Props) {
  const { t } = useTranslation("musicImport");
  const { t: tr } = useTranslation("musicReleases");

  if ((state.phase === "files" || state.phase === "paused") && release) {
    return <ReleaseImportProgress titleId={titleId} state={release} onHide={onHide} onCancel={onCancel} onResume={onResume} />;
  }
  if (state.phase === "files" || state.phase === "paused" || state.phase === "filling") {
    return (
      <div className="flex items-center gap-3" aria-live="polite">
        <Loader2 className="h-6 w-6 shrink-0 animate-spin text-content-tertiary motion-reduce:animate-none" aria-hidden />
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">
            {t(state.phase === "filling" ? "filling" : "sending")}
          </h2>
          {state.label && <p className="truncate text-sm text-content-tertiary">{state.label}</p>}
        </div>
      </div>
    );
  }

  const result = state.result;
  if (state.phase === "done" && result) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1" aria-live="polite">
          <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">
            {t("doneTitle", { name: result.name })}
          </h2>
          <p className="text-sm text-content-secondary">{t("intoDone", { count: result.added, name: result.name })}</p>
          {result.pending > 0 && <p className="text-sm text-content-tertiary">{t("intoPending", { count: result.pending })}</p>}
          {result.refused > 0 && <p className="text-sm text-amber-300">{t("intoRefused", { count: result.refused })}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`${BUTTON} text-content-tertiary hover:text-content-primary`}>
            {t("close")}
          </button>
          <button type="button" onClick={() => onOpen(result.playlistId)} className={`${BUTTON} octave-brand-fill`}>
            {t("open")}
          </button>
        </div>
      </div>
    );
  }

  // Un refus de la chaîne des sorties a ses mots là-bas ; ceux de l'ajout, ici.
  const failure = state.failure ?? "failed";
  const message = failure === "empty" || failure === "failed" || failure === "network" ? t(`intoFailure.${failure}`) : tr(`refusal.${failure}`);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3" role="alert">
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
        <h2 id={titleId} className="text-sm text-content-primary">
          {message}
        </h2>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={`${BUTTON} text-content-tertiary hover:text-content-primary`}>
          {t("close")}
        </button>
        <button type="button" onClick={onRetry} className={`${BUTTON} octave-brand-fill`}>
          {t("retry")}
        </button>
      </div>
    </div>
  );
}
