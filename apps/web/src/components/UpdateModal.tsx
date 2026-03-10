import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useAutoUpdate, type UpdatePhase } from "../hooks/useAutoUpdate";

function Spinner() {
  return (
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full space-y-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-center text-sm text-white/50">{progress}%</p>
    </div>
  );
}

function ModalContent({
  phase,
  notes,
  progress,
  onInstall,
  onDismiss,
  t,
}: {
  phase: UpdatePhase;
  notes?: string;
  progress: number;
  onInstall: () => void;
  onDismiss: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  if (phase === "installing") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Spinner />
        <p className="text-sm text-white/70">{t("notifications:updateInstalling")}</p>
      </div>
    );
  }

  if (phase === "restarting") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Spinner />
        <p className="text-sm text-white/70">{t("notifications:updateRestarting")}</p>
      </div>
    );
  }

  if (phase === "downloading") {
    return (
      <div className="space-y-4 py-2">
        <ProgressBar progress={progress} />
        <p className="text-center text-sm text-white/50">{t("notifications:downloading", { progress })}</p>
      </div>
    );
  }

  // phase === "available"
  return (
    <>
      {notes && (
        <div className="max-h-32 overflow-y-auto rounded-lg bg-white/5 p-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-white/40">
            {t("notifications:updateReleaseNotes")}
          </p>
          <p className="whitespace-pre-line text-sm text-white/60">{notes}</p>
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onInstall}
          className="flex-1 rounded-xl bg-[#8B5CF6] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          {t("notifications:updateNow")}
        </button>
        <button
          onClick={onDismiss}
          className="rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white/60 transition-colors hover:bg-white/10"
        >
          {t("notifications:later")}
        </button>
      </div>
    </>
  );
}

export function UpdateModal() {
  const { t } = useTranslation("notifications");
  const { available, phase, version, notes, progress, installUpdate, dismiss } = useAutoUpdate();

  if (!available) return null;

  const canClose = phase === "available";

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={canClose ? dismiss : undefined}
    >
      <div
        className="mx-4 w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-[#080812]/95 p-6 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            {t("notifications:updateAvailable")}
          </h2>
          {version && (
            <span className="rounded-full bg-purple-500/20 px-3 py-0.5 text-xs font-medium text-purple-300">
              v{version}
            </span>
          )}
        </div>

        <ModalContent
          phase={phase}
          notes={notes}
          progress={progress}
          onInstall={installUpdate}
          onDismiss={dismiss}
          t={t}
        />
      </div>
    </div>,
    document.body,
  );
}
