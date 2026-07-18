import { useTranslation } from "react-i18next";

/**
 * Barre de chargement indéterminée (segment qui glisse). Repli accessible :
 * sous `prefers-reduced-motion`, barre pleine en pulsation douce plutôt qu'un
 * mouvement continu. Réutilisée par l'écran de chargement et l'overlay player.
 *
 * Toujours posée sur un backdrop/vidéo → bg-white/12 volontairement en dur.
 */
export function LoadingBar({ className = "" }: { className?: string }) {
  return (
    <div className={`relative h-[3px] w-full overflow-hidden rounded-full bg-white/12 ${className}`}>
      <div className="absolute inset-y-0 left-0 w-1/4 rounded-full bg-gradient-to-r from-transparent via-[var(--brand-light)] to-transparent animate-loading-bar motion-reduce:w-full motion-reduce:bg-[var(--brand)] motion-reduce:from-[var(--brand)] motion-reduce:to-[var(--brand)] motion-reduce:animate-pulse" />
    </div>
  );
}

interface PlayerLoadingScreenProps {
  /** Backdrop de l'épisode/film à afficher en fond (peut être absent au tout début). */
  posterUrl?: string;
  /** Titre principal (série ou film). */
  title?: string;
  /** Sous-titre (ex. « S02E04 — On ne prend plus de gants »). */
  subtitle?: string;
}

/**
 * Écran affiché pendant le chargement d'un média (avant le démarrage de la
 * lecture) : bannière de l'épisode/film + barre de chargement. Remplace
 * l'ancien splash animé « poulpe TENTACLE ».
 *
 * Posé sur le backdrop de l'épisode/film → couleurs volontairement en dur
 * (text-white, scrim bg-black) dans les deux thèmes clair/sombre.
 */
export function PlayerLoadingScreen({ posterUrl, title, subtitle }: PlayerLoadingScreenProps) {
  const { t } = useTranslation("player");
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a0a12]">
      {/* Fond de repli teinté marque, visible tant que le backdrop n'est pas chargé */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(var(--brand-rgb),0.20),transparent_60%)]" />
      {posterUrl && (
        <img
          src={posterUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover animate-[fadeIn_0.5s_ease]"
        />
      )}
      {/* Scrim pour la lisibilité du titre + de la barre */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/35" />

      <div className="absolute inset-x-0 bottom-0 px-8 pb-14 md:px-16 md:pb-20">
        {title && (
          <h1 className="mb-1.5 max-w-3xl truncate text-2xl font-bold tracking-tight text-white md:text-4xl">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="mb-6 max-w-3xl truncate text-sm text-white/55 md:text-base">{subtitle}</p>
        )}
        {!subtitle && <div className="mb-6" />}
        <LoadingBar />
        <span className="sr-only" role="status">
          {title ? t("player:loadingMedia", { title }) : t("player:loading", "Chargement…")}
        </span>
      </div>
    </div>
  );
}
