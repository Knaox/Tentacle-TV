import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";

interface NextEpisodeFullscreenProps {
  /** Secondes restantes avant lecture auto (piloté par le lecteur). */
  countdown: number;
  /** Titre pré-formaté "S03E08 — Nom" (label et nom séparés au rendu si besoin). */
  episodeTitle?: string;
  /** Label "S03E08" optionnel (sinon extrait de `episodeTitle`). */
  episodeLabel?: string;
  episodeDescription?: string;
  /** Bannière de la SÉRIE — fond plein écran immersif. */
  seriesBackdropUrl?: string;
  /** Miniature (Primary) de l'épisode suivant — vignette. */
  episodeThumbUrl?: string;
  onPlayNow: () => void;
  onDismiss: () => void;
  /** Valeur initiale du compte à rebours, pour la progression (défaut 10 s). */
  totalSeconds?: number;
}

const DEFAULT_TOTAL = 10;
const RING_R = 30;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Affiche PLEIN ÉCRAN « épisode suivant » (post-play, façon Netflix), présentée
 * à la FIN d'un épisode (EOF). Fond = bannière de la SÉRIE assombrie ; au centre,
 * la vignette de l'épisode suivant + saison/épisode + résumé + compte à rebours
 * bien visible. Auto-play annulable. Cohérente avec le thème glassmorphism
 * violet→rose de l'app (tokens --brand). Lecteur desktop (Tauri / MPV).
 */
export function NextEpisodeFullscreen({
  countdown,
  episodeTitle,
  episodeLabel,
  episodeDescription,
  seriesBackdropUrl,
  episodeThumbUrl,
  onPlayNow,
  onDismiss,
  totalSeconds = DEFAULT_TOTAL,
}: NextEpisodeFullscreenProps) {
  const { t } = useTranslation("player");
  const reduce = useReducedMotion();

  // Sépare "S03E08 — Nom" en label + nom quand le label n'est pas fourni.
  let label = episodeLabel;
  let title = episodeTitle;
  if (!label && episodeTitle) {
    const idx = episodeTitle.indexOf(" — ");
    if (idx > 0) {
      label = episodeTitle.slice(0, idx);
      title = episodeTitle.slice(idx + 3);
    }
  }

  const progress = Math.max(0, Math.min(1, (totalSeconds - countdown) / totalSeconds));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="absolute inset-0 z-40 flex items-center justify-center overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={t("player:upNext")}
    >
      {/* Fond = bannière de la SÉRIE, assombrie (léger ken-burns hors reduced-motion) */}
      {seriesBackdropUrl ? (
        <motion.img
          src={seriesBackdropUrl}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          initial={reduce ? false : { scale: 1.05 }}
          animate={{ scale: 1 }}
          transition={{ duration: 8, ease: "easeOut" }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: "var(--surface-1)" }} />
      )}
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.72)" }} />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.7) 100%)" }}
      />

      {/* Fermer */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("player:dismiss")}
        className="absolute right-5 top-5 z-10 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white/85 outline-none transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70"
        style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Panneau central */}
      <motion.div
        className="relative z-[1] w-full max-w-4xl px-8"
        initial={reduce ? false : { opacity: 0, y: 20, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: reduce ? 0 : 0.1 }}
      >
        {/* Compte à rebours — bien visible */}
        <div className="mb-5 flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--brand-light)", boxShadow: "0 0 10px var(--brand)" }} />
          <span
            className="text-sm font-bold uppercase tracking-[0.16em] text-white/90"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}
          >
            {t("player:autoplayCountdown", { seconds: countdown })}
          </span>
        </div>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {/* Vignette de l'épisode suivant */}
          <div
            className="relative w-full shrink-0 overflow-hidden rounded-xl sm:w-72"
            style={{ boxShadow: "0 16px 44px rgba(0,0,0,0.6), 0 0 0 1px rgba(var(--brand-rgb),0.25)" }}
          >
            <div className="aspect-[16/9] w-full" style={{ background: "var(--surface-1)" }}>
              {episodeThumbUrl && (
                <img src={episodeThumbUrl} alt="" draggable={false} className="h-full w-full object-cover" />
              )}
            </div>
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm">
                <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              </span>
            </span>
          </div>

          {/* Infos épisode */}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/55" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}>
              {t("player:upNext")}
            </p>
            {label && (
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-white/60" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}>
                {label}
              </p>
            )}
            {title && (
              <h2 className="mt-1 text-2xl font-extrabold leading-tight text-white sm:text-3xl lg:text-4xl" style={{ textShadow: "0 2px 14px rgba(0,0,0,0.7)" }}>
                {title}
              </h2>
            )}
            {episodeDescription && (
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-white/70 sm:text-[15px]" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.85)" }}>
                {episodeDescription}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {/* Lire maintenant — anneau de progression du compte à rebours */}
              <button
                type="button"
                onClick={onPlayNow}
                className="group flex cursor-pointer items-center gap-3 rounded-xl bg-white py-3 pl-3 pr-6 text-base font-bold text-black outline-none transition-transform duration-150 hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-white/80"
                style={{ boxShadow: "0 8px 28px var(--brand-glow)" }}
              >
                <span className="relative flex h-10 w-10 items-center justify-center">
                  <svg className="absolute inset-0 h-10 w-10 -rotate-90" viewBox="0 0 72 72" aria-hidden="true">
                    <circle cx="36" cy="36" r={RING_R} fill="none" stroke="rgba(0,0,0,0.14)" strokeWidth="5" />
                    <circle
                      cx="36" cy="36" r={RING_R} fill="none"
                      stroke="var(--brand)" strokeWidth="5" strokeLinecap="round"
                      strokeDasharray={RING_C}
                      strokeDashoffset={RING_C * (1 - progress)}
                      style={{ transition: "stroke-dashoffset 1s linear" }}
                    />
                  </svg>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </span>
                {t("player:playNow")}
              </button>

              <button
                type="button"
                onClick={onDismiss}
                className="cursor-pointer rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-base font-semibold text-white/80 outline-none backdrop-blur-sm transition-colors duration-150 hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
              >
                {t("player:dismiss")}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
