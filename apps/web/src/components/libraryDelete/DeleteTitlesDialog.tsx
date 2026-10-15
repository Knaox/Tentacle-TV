import { useCallback, useId, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { useLibraryDeletion, type DeletableEntry, type DeletionRunSummary } from "@tentacle-tv/api-client";
import { confirmationPreview } from "@tentacle-tv/shared";
import { Modal } from "../ui/Modal";
import { DeletionProgressView, DeletionSummaryView, TitleList } from "./DeletionRunViews";
import { DIALOG_CANCEL, DIALOG_DANGER } from "./dialogButtons";

interface Props {
  open: boolean;
  /** Les titres à supprimer, dans l'ordre affiché. */
  entries: readonly DeletableEntry[];
  onClose: () => void;
  /** Chaque passage fini (la suppression, puis chaque « Réessayer ») : de quoi élaguer, revenir en arrière. */
  onFinished?: (summary: DeletionRunSummary) => void;
}

/**
 * Supprimer des titres : confirmer (combien, lesquels, le disque, l'irréversible),
 * suivre (lots, progression, « Arrêter »), lire le bilan (ce qui est parti, et
 * NOMMÉMENT ce qui ne l'est pas). Annuler a le premier focus ; pendant la
 * suppression, ni Échap ni le fond ne referment : rien ne s'arrête en silence.
 */
export function DeleteTitlesDialog({ open, entries, onClose, onFinished }: Props) {
  const { t } = useTranslation("libraryDelete");
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { state, run, stop, reset } = useLibraryDeletion();
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

  const close = useCallback(() => {
    if (state.phase === "running") return;
    reset();
    onClose();
  }, [state.phase, reset, onClose]);

  const start = useCallback(async (ids: readonly string[]) => {
    const summary = await run(ids);
    if (summary) onFinished?.(summary);
  }, [run, onFinished]);

  const preview = useMemo(() => confirmationPreview(entries.map((e) => e.name)), [entries]);
  const takesChildren = entries.some((e) => e.type === "Series" || e.type === "Season");
  const single = entries.length === 1 ? entries[0] : null;

  return (
    <Modal
      open={open}
      onClose={close}
      maxWidth={520}
      dismissOnBackdrop={state.phase !== "running"}
      labelledBy={titleId}
      describedBy={descId}
      initialFocus={() => cancelRef.current}
    >
      <div className="p-6">
        {state.phase === "running" ? (
          <DeletionProgressView titleId={titleId} descId={descId} state={state} onStop={stop} />
        ) : state.phase === "done" ? (
          <DeletionSummaryView
            titleId={titleId}
            descId={descId}
            summary={state.summary}
            nameOf={(id) => byId.get(id)?.name ?? id}
            onRetry={(ids) => void start(ids)}
            onClose={close}
          />
        ) : (
          <>
            <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">
              {single ? t("confirmTitleOne", { name: single.name }) : t("confirmTitle", { count: entries.length })}
            </h2>
            {!single && (
              <TitleList
                className="mt-3"
                items={preview.names.map((name, i) => ({ name, type: entries[i]?.type }))}
                more={preview.more}
              />
            )}
            <div id={descId} className="mt-4 flex gap-3 rounded-xl border border-danger-border bg-danger-surface p-3.5">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--status-error-fg)]" strokeWidth={2.2} aria-hidden />
              <div className="text-sm leading-relaxed text-content-primary">
                <p className="font-semibold">{t("diskWarning")}</p>
                {takesChildren && <p className="mt-1 text-content-secondary">{t("seriesNote")}</p>}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button ref={cancelRef} type="button" onClick={close} className={DIALOG_CANCEL}>{t("cancel")}</button>
              <button
                type="button"
                onClick={() => void start(entries.map((e) => e.id))}
                disabled={entries.length === 0}
                className={DIALOG_DANGER}
              >
                {t("confirm", { count: entries.length })}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
