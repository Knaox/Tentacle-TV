import { useTranslation } from "react-i18next";
import { useAutoUpdate } from "../hooks/useAutoUpdate";
import { isTauri } from "../hooks/useDesktopPlayer";

export function UpdateNotification() {
  const { t } = useTranslation("notifications");
  const { available, version, notes, downloading, progress, error, installUpdate, dismiss } = useAutoUpdate();

  if (!isTauri() || !available) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 overflow-hidden rounded-2xl border border-white/10 bg-tentacle-surface/95 shadow-2xl backdrop-blur-xl">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">
              {t("notifications:updateAvailable")}
            </h3>
            {version && (
              <p className="mt-0.5 text-xs text-purple-400">
                v{version}
              </p>
            )}
          </div>
          <button onClick={dismiss}
            className="rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {notes && (
          <p className="mt-2 text-xs text-white/50 line-clamp-2">{notes}</p>
        )}

        {error && (
          <p className="mt-2 text-xs text-red-400">{error}</p>
        )}

        {downloading ? (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1 text-center text-xs text-white/40">
              {t("notifications:downloading", { progress })}
            </p>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <button onClick={installUpdate}
              className="flex-1 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90">
              {t("notifications:install")}
            </button>
            <button onClick={dismiss}
              className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60 hover:bg-white/10">
              {t("notifications:later")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
