import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useAutoUpdate, type UpdatePhase } from "../hooks/useAutoUpdate";

function Spinner() {
  return (
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <defs>
        <linearGradient id="sparkleGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A855F7" />
          <stop offset="1" stopColor="#EC4899" />
        </linearGradient>
      </defs>
      <path
        d="M12 2l2.39 6.04L20.5 9.5l-4.55 3.96L17.39 20 12 16.27 6.61 20l1.44-6.54L3.5 9.5l6.11-1.46L12 2z"
        fill="url(#sparkleGrad)"
      />
    </svg>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full space-y-2">
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
        {/* Shimmer overlay */}
        <div
          className="absolute inset-y-0 left-0 h-full overflow-hidden rounded-full"
          style={{ width: `${progress}%` }}
        >
          <div className="h-full w-full animate-pulse bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
      </div>
      <p className="text-center text-xs font-medium text-white/60">{progress}%</p>
    </div>
  );
}

function ModalContent({
  phase,
  notes,
  progress,
  error,
  onInstall,
  onDismiss,
  t,
}: {
  phase: UpdatePhase;
  notes?: string;
  progress: number;
  error: string | null;
  onInstall: () => void;
  onDismiss: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  if (phase === "downloading") {
    return (
      <div className="space-y-4 py-2">
        <ProgressBar progress={progress} />
        <p className="text-center text-sm text-white/60">{t("notifications:downloading", { progress })}</p>
        <p className="text-center text-xs text-white/40">{t("notifications:restartHint")}</p>
      </div>
    );
  }

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
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onInstall}
          className="flex-1 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-purple-500/50 hover:brightness-110"
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
  const { available, phase, version, notes, progress, error, installUpdate, dismiss } = useAutoUpdate();


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
          <div className="flex items-center gap-2.5">
            <SparkleIcon />
            <h2 className="text-lg font-semibold text-white">
              {t("notifications:updateAvailable")}
            </h2>
          </div>
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
          error={error}
          onInstall={installUpdate}
          onDismiss={dismiss}
          t={t}
        />
      </div>
    </div>,
    document.body,
  );
}
