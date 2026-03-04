import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

interface NextEpisodeOverlayProps {
  countdown: number;
  episodeTitle?: string;
  episodeDescription?: string;
  episodeImageUrl?: string;
  onPlayNow: () => void;
  onDismiss: () => void;
}

const COUNTDOWN_TOTAL = 10;

export function NextEpisodeOverlay({ countdown, episodeTitle, episodeDescription, episodeImageUrl, onPlayNow, onDismiss }: NextEpisodeOverlayProps) {
  const { t } = useTranslation("player");
  const progress = ((COUNTDOWN_TOTAL - countdown) / COUNTDOWN_TOTAL) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.95 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="absolute bottom-6 right-6 z-30 w-[340px] overflow-hidden rounded-xl border border-white/10 bg-black/60 shadow-2xl backdrop-blur-xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Progress bar */}
      <div className="h-1 w-full bg-white/10">
        <div
          className="h-full bg-tentacle-accent transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-3.5">
        {/* Header */}
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-tentacle-accent">
            {t("player:upNext")}
          </span>
          <button
            onClick={onDismiss}
            className="rounded-full p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
            title={t("player:dismiss")}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content row */}
        <div className="flex gap-3">
          {/* Thumbnail */}
          {episodeImageUrl && (
            <div className="h-[72px] w-[128px] flex-shrink-0 overflow-hidden rounded-lg bg-white/5">
              <img src={episodeImageUrl} alt="" className="h-full w-full object-cover" />
            </div>
          )}

          {/* Info */}
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            {episodeTitle && (
              <p className="truncate text-sm font-medium text-white">{episodeTitle}</p>
            )}
            {episodeDescription && (
              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-white/50">{episodeDescription}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={onPlayNow}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-tentacle-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-tentacle-accent/80"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            {t("player:playNow")}
          </button>
          <span className="text-xs tabular-nums text-white/40">
            {countdown}{t("player:secondsShort")}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
