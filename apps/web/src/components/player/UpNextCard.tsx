import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

interface UpNextCardProps {
  /**
   * Secondes restantes avant l'enchaînement automatique, ou `null` quand il n'y
   * en a pas — la carte est alors une simple PROPOSITION, affichée dès le
   * générique : ni compte à rebours, ni barre de progression, puisqu'il n'y
   * aurait rien à mesurer. Elle prend la place du bouton « Épisode suivant »
   * qu'on affichait jusque-là.
   */
  countdown: number | null;
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
  const counting = countdown !== null;
  const progress = counting ? ((totalSeconds - countdown) / totalSeconds) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.96, transition: { duration: 0.16 } }}
      transition={{ type: "spring", damping: 22, stiffness: 280 }}
      className="absolute bottom-4 right-4 z-30 w-[min(420px,calc(100vw-2rem))] overflow-hidden sm:bottom-6 sm:right-6"
      onClick={(e) => e.stopPropagation()}
      // PAS de `backdrop-filter` sur la carte. `--surface-modal` est à 0,96
      // d'alpha : quatre pour cent de l'image passent au travers, flouter ou
      // non n'y change rien à l'œil. Le coût, lui, est bien réel — la carte
      // flotte au-dessus d'une vidéo EN LECTURE, dont l'arrière-plan change
      // vingt-quatre à soixante fois par seconde, et chaque changement force
      // une recopie de la région et une passe de flou de 20 px.
      // Même arbitrage que le panneau d'aperçu (cf. theme/surfaces.css).
      style={{
        background: "var(--surface-modal)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "0 20px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(var(--brand-rgb), 0.18), 0 0 32px rgba(var(--brand-rgb), 0.18)",
      }}
    >
      {/* Barre de progression — seulement quand un décompte court. Sans lui
          elle resterait vide en haut de la carte, à suggérer une attente qui
          n'existe pas. */}
      {counting && (
        <div className="h-[3px] w-full overflow-hidden bg-fill-soft">
          <div
            className="h-full transition-[width] duration-1000 ease-linear"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, var(--brand-light), var(--brand))",
              boxShadow: "0 0 12px rgba(var(--brand-rgb), 0.6)",
            }}
          />
        </div>
      )}

      {/* Backdrop image strip — fades into surface for text legibility.
          Badges/bouton fermer sont posés sur l'image : restent en dur
          (text-white, rgba(0,0,0,X)) quel que soit le thème. */}
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
          {/* Compte à rebours — uniquement quand l'enchaînement automatique
              court. Proposée pendant le générique, la carte n'annonce aucune
              échéance : elle attend un clic, elle ne prévient pas d'un
              départ. */}
          {counting && (
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
          )}
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

      {/* Episode meta + actions — sous la bannière, sur le fond `surface-modal`
          de la carte (pas sur l'image) : tokenisé, suit le thème. */}
      <div className="px-5 pb-4 pt-1">
        {episodeLabel && (
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-content-tertiary">
            {episodeLabel}
          </p>
        )}
        {episodeTitle && (
          <p className="mt-0.5 truncate text-[15px] font-semibold text-content-primary">
            {episodeTitle}
          </p>
        )}
        {episodeDescription && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-content-tertiary">
            {episodeDescription}
          </p>
        )}

        <div className="mt-3.5 flex items-center gap-2">
          <button
            type="button"
            onClick={onPlay}
            className="group/play flex flex-1 items-center justify-center gap-2 rounded-md bg-cta-primary-bg py-2.5 text-sm font-bold text-cta-primary-fg transition-all duration-150 hover:scale-[1.02] hover:bg-cta-primary-bg-hover"
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
            className="rounded-md px-4 py-2.5 text-sm font-medium text-content-tertiary transition-colors hover:bg-fill-soft hover:text-content-primary"
          >
            {t("player:dismiss")}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
