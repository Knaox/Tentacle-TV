/**
 * L'affiche PLEIN ÉCRAN « épisode suivant » — présentée à la toute FIN d'un
 * épisode (EOF), quand il n'y a plus d'image à couvrir.
 *
 * Même matière que la pilule de saut et la fiche « à suivre »
 * (`overlayPill.tsx`) : l'action est une pilule blanche opaque, et le temps
 * qui reste se MONTRE dans le geste — le voile `Sweep` balaye « Lire
 * maintenant » pendant que le libellé décompte. L'anneau SVG d'avant relançait
 * sa transition `stroke-dashoffset` à chaque seconde : une propriété qui n'est
 * ni `transform` ni `opacity`, battue quatre fois par seconde, pour dire ce
 * que le balayage dit déjà.
 *
 * PAS de `backdrop-filter` — nulle part. La croix et le bouton « Masquer » en
 * portaient un ; l'assombrissement vient désormais de DÉGRADÉS noirs empilés
 * sur la bannière, et les pastilles sont des aplats. Sur les fenêtres à canal
 * alpha (Electron mac/linux), du blanc semi-transparent rendrait GRIS et un
 * flou large sortirait en aplat (cf. `lib/videoShadow.ts`) : les voiles sont
 * noirs, les ombres passent par `videoShadow`.
 *
 * Refuser l'affiche SORT du lecteur (retour à la fiche du média) : la croix et
 * le bouton secondaire disent ce qu'ils font — `backToDetails`, plus un
 * « Masquer » qui laissait une image figée.
 *
 * Le balayage s'arme au PREMIER rendu décompté, pas au montage : l'affiche
 * peut paraître un battement avant que le moteur n'arme le minuteur (EOF après
 * refus de la carte), et à l'ESCALADE carte → affiche le minuteur continue —
 * `initialProgress` reprend le trajet où il en était, sur la durée restante.
 */

import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { videoShadow } from "../../lib/videoShadow";
import { Sweep, Veil } from "./overlayPill";

interface NextEpisodeFullscreenProps {
  /**
   * Secondes restantes avant lecture auto, ou `null` quand l'affiche est une
   * simple PROPOSITION — le compte à rebours a été éteint dans les réglages.
   * Ni chiffre ni balayage alors : il n'y aurait aucune échéance à annoncer,
   * et en afficher une qui n'arrive jamais serait un mensonge à l'écran.
   */
  countdown: number | null;
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

/** L'entrée du panneau, au tempo des surfaces du lecteur. */
const EASE_OUT = [0, 0, 0.2, 1] as const;

/** L'ombre de la vignette — le liseré seul là où la surface a un canal alpha. */
const THUMB_SHADOW = videoShadow(
  "0 16px 44px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.12)",
  "0 0 0 1px rgba(255, 255, 255, 0.18)",
);

/** L'ombre de la pilule — la même que celle du bouton de saut. */
const PILL_SHADOW = videoShadow(
  "0 8px 28px rgba(0, 0, 0, 0.45)",
  "0 0 0 1px rgba(0, 0, 0, 0.15)",
);

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

  const counting = countdown !== null;

  // Figé au PREMIER rendu décompté (initialisation paresseuse d'une ref,
  // idempotente) : la `key` du Sweep suit la durée armée, jamais les secondes.
  const armedRef = useRef<{ remaining: number; total: number } | null>(null);
  if (counting && armedRef.current === null) {
    armedRef.current = { remaining: countdown, total: Math.max(countdown, totalSeconds) };
  }
  const armed = armedRef.current;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="absolute inset-0 z-40 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={t("player:upNext")}
    >
      {/* Fond = bannière de la SÉRIE, très léger ken-burns (transform only,
          rien hors reduced-motion) ; sans bannière, l'aplat de surface. */}
      {seriesBackdropUrl ? (
        <motion.img
          src={seriesBackdropUrl}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          initial={reduce ? false : { scale: 1.06 }}
          animate={{ scale: 1 }}
          transition={{ duration: 8, ease: "easeOut" }}
        />
      ) : (
        // Repli SOMBRE en dur, pas une surface de l'application : le texte de
        // l'affiche est blanc en dur (posé sur image), et `--surface-1` en
        // thème clair l'aurait rendu illisible. Même dégradé « image de film »
        // que le cadre d'aperçu des réglages.
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, #2b2436 0%, #16131c 55%, #0a0a0d 100%)" }}
        />
      )}
      {/* Assombrissement par dégradés NOIRS empilés — un latéral qui ancre le
          panneau à gauche et laisse la bannière respirer à droite, un vertical
          qui assoit le bas. Du blanc semi-transparent rendrait gris (alpha). */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.52) 45%, rgba(0,0,0,0.26) 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.20) 45%, rgba(0,0,0,0.45) 100%)",
        }}
      />

      {/* La croix — même dessin que celle de la fiche, sur pastille OPAQUE.
          Elle SORT du lecteur : son libellé le dit. */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("player:backToDetails")}
        title={t("player:backToDetails")}
        className="absolute right-5 top-5 z-10 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white/85 outline-none transition-colors duration-150 motion-reduce:transition-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/70"
        style={{ background: "rgba(0,0,0,0.65)" }}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Panneau bas-gauche, composition d'affiche : vignette, sur-titre,
          titre, synopsis, gestes. Entrée en translation/opacité seulement. */}
      <motion.div
        className="absolute inset-x-0 bottom-0 z-[1] flex flex-col gap-6 p-8 sm:flex-row sm:items-end sm:p-12 lg:p-16"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE_OUT, delay: reduce ? 0 : 0.08 }}
      >
        {/* Vignette de l'épisode suivant — nue : la pilule porte déjà le geste,
            une pastille « play » par-dessus le disait une seconde fois. */}
        <div
          className="relative w-full max-w-[280px] shrink-0 overflow-hidden rounded-xl sm:w-72 sm:max-w-none"
          style={{ boxShadow: THUMB_SHADOW }}
        >
          <div className="aspect-[16/9] w-full" style={{ background: "#16131c" }}>
            {episodeThumbUrl && (
              <img src={episodeThumbUrl} alt="" draggable={false} className="h-full w-full object-cover" />
            )}
          </div>
        </div>

        {/* Infos épisode */}
        <div className="min-w-0 max-w-2xl flex-1">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}
          >
            {t("player:upNext")}
          </p>
          {label && (
            <p
              className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-white/60"
              style={{ textShadow: "0 1px 4px rgba(0,0,0,0.85)" }}
            >
              {label}
            </p>
          )}
          {title && (
            <h2
              className="mt-1 text-2xl font-extrabold leading-tight text-white sm:text-3xl lg:text-4xl"
              style={{ textShadow: "0 2px 14px rgba(0,0,0,0.7)" }}
            >
              {title}
            </h2>
          )}
          {episodeDescription && (
            <p
              className="mt-3 line-clamp-3 text-sm leading-relaxed text-white/70 sm:text-[15px]"
              style={{ textShadow: "0 1px 6px rgba(0,0,0,0.85)" }}
            >
              {episodeDescription}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {/* LA pilule, à la lettre (cf. UpNextCard) : aplat blanc, voile de
                survol, balayage du décompte AVANT le libellé — donc dessous. */}
            <button
              type="button"
              onClick={onPlayNow}
              className="group/play relative flex min-h-11 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-cta-primary-border bg-cta-primary-bg px-7 text-sm font-bold text-cta-primary-fg outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/60"
              style={{ boxShadow: PILL_SHADOW }}
            >
              <Veil className="group-hover/play:opacity-100" />
              {counting && armed && (
                <Sweep
                  key={String(armed.total)}
                  durationMs={armed.remaining * 1000}
                  // Arrondi au millième : 1 − 8/10 donne 0,19999…96 en IEEE 754,
                  // et dix-sept décimales n'apportent rien à un scaleX.
                  initialProgress={Math.round((1 - armed.remaining / armed.total) * 1000) / 1000}
                />
              )}
              <span className="relative flex items-center gap-2 tabular-nums">
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                {counting ? t("player:playNowIn", { seconds: countdown }) : t("player:playNow")}
              </span>
            </button>

            {/* Secondaire fantôme — couleurs seules au survol, aucun flou. */}
            <button
              type="button"
              onClick={onDismiss}
              className="min-h-11 cursor-pointer rounded-full border border-white/25 px-6 text-sm font-semibold text-white/85 outline-none transition-colors duration-150 motion-reduce:transition-none hover:border-white/50 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {t("player:backToDetails")}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
