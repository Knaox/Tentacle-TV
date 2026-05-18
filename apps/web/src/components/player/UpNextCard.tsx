import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

interface UpNextCardProps {
  countdown: number;
  /** Episode title (e.g. "Le piège du Major"). */
  episodeTitle?: string;
  /** Optional sub-label like "S03E08". */
  episodeLabel?: string;
  episodeDescription?: string;
  episodeImageUrl?: string;
  onPlay: () => void;
  onDismiss: () => void;
  /** Initial countdown value used for progress (defaults to 10s). */
  totalSeconds?: number;
}

const DEFAULT_TOTAL = 10;

/**
 * Cinema-style "Up Next" card displayed at the bottom-right of the player
 * a few seconds before the current episode ends.
 *
 * Replaces the legacy NextEpisodeOverlay/AutoPlayOverlay treatment
 * (320px, violet button, plain bg). The new card:
 *   - Uses the episode backdrop as its background with a fade-to-black scrim
 *   - 420px wide for a more present, premium feel
 *   - White Play CTA with violet glow (consistent with hero / detail page)
 *   - Tokens-driven (surface-modal, brand, status-error tints)
 *   - Brand-gradient progress bar with glow
 *   - Spring entry animation, exit faster than enter
 */
export function UpNextCard({
  countdown,
  episodeTitle,
  episodeLabel,
  episodeDescription,
  episodeImageUrl,
  onPlay,
  onDismiss,
  totalSeconds = DEFAULT_TOTAL,
}: UpNextCardProps) {
  const { t } = useTranslation("player");
  const progress = ((totalSeconds - countdown) / totalSeconds) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.96, transition: { duration: 0.16 } }}
      transition={{ type: "spring", damping: 22, stiffness: 280 }}
      className="absolute bottom-4 right-4 z-30 w-[min(420px,calc(100vw-2rem))] overflow-hidden sm:bottom-6 sm:right-6"
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "var(--surface-modal)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "0 20px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(var(--brand-rgb), 0.18), 0 0 32px rgba(var(--brand-rgb), 0.18)",
        backdropFilter: "blur(var(--blur-modal))",
        WebkitBackdropFilter: "blur(var(--blur-modal))",
      }}
    >
      {/* Top progress bar — gradient violet with glow */}
      <div className="h-[3px] w-full overflow-hidden bg-white/10">
        <div
          className="h-full transition-[width] duration-1000 ease-linear"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, var(--brand-light), var(--brand))",
            boxShadow: "0 0 12px rgba(var(--brand-rgb), 0.6)",
          }}
        />
      </div>

      {/* Backdrop image strip — fades into surface for text legibility */}
      <div className="relative aspect-[16/7] w-full overflow-hidden">
        {episodeImageUrl ? (
          <img
            src={episodeImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0" style={{ background: "var(--surface-1)" }} />
        )}
        {/* Bottom scrim — fades to surface-modal */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(15,15,21,0.55) 55%, var(--surface-modal) 100%)",
          }}
        />
        {/* Top-left badge — UP NEXT + countdown */}
        <div className="absolute left-4 top-3 flex items-center gap-2">
          <span
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white"
            style={{
              background: "rgba(0, 0, 0, 0.6)",
              border: "1px solid rgba(var(--brand-rgb), 0.55)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              textShadow: "0 1px 3px rgba(0,0,0,0.85)",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: "var(--brand-light)",
                boxShadow: "0 0 8px var(--brand)",
              }}
            />
            {t("player:upNext")}
          </span>
          <span
            className="rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums text-white"
            style={{
              background: "rgba(0, 0, 0, 0.55)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              textShadow: "0 1px 3px rgba(0,0,0,0.85)",
            }}
          >
            {countdown}
            {t("player:secondsShort")}
          </span>
        </div>
        {/* Top-right close */}
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("player:dismiss")}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-black/40 hover:text-white"
          style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)" }}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Episode meta + actions */}
      <div className="px-5 pb-4 pt-1">
        {episodeLabel && (
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
            {episodeLabel}
          </p>
        )}
        {episodeTitle && (
          <p className="mt-0.5 truncate text-[15px] font-semibold text-white">
            {episodeTitle}
          </p>
        )}
        {episodeDescription && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/55">
            {episodeDescription}
          </p>
        )}

        <div className="mt-3.5 flex items-center gap-2">
          <button
            type="button"
            onClick={onPlay}
            className="group/play flex flex-1 items-center justify-center gap-2 rounded-md bg-white py-2.5 text-sm font-bold text-black transition-all duration-150 hover:scale-[1.02] hover:bg-white/90"
            style={{ boxShadow: "0 6px 22px var(--brand-glow)" }}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            {t("player:playNow")}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md px-4 py-2.5 text-sm font-medium text-white/65 transition-colors hover:bg-white/10 hover:text-white"
          >
            {t("player:dismiss")}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
