import { useEffect } from "react";
import { useTranslation } from "react-i18next";

/**
 * Barre de chargement indéterminée (segment qui glisse). Repli accessible :
 * sous `prefers-reduced-motion`, barre pleine en pulsation douce plutôt qu'un
 * mouvement continu. Réutilisée par l'écran de chargement et l'overlay player.
 *
 * Toujours posée sur un backdrop/vidéo → bg-white/10 volontairement en dur.
 */
export function LoadingBar({ className = "" }: { className?: string }) {
  return (
    <div className={`relative h-[3px] w-full overflow-hidden rounded-full bg-white/10 ${className}`}>
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
  /**
   * Quitter sans attendre le démarrage.
   *
   * L'écran occupe toute la fenêtre AVANT que le lecteur existe : ni ses
   * contrôles, ni son raccourci d'échappement ne sont encore montés. Une
   * ouverture qui traîne — serveur lent, transcodage qui démarre — enfermait
   * donc devant une barre qui tourne. Le bouton et la touche Échap sont ici,
   * et nulle part ailleurs, pour cette raison.
   */
  onCancel?: () => void;
}

/**
 * Écran affiché pendant le chargement d'un média (avant le démarrage de la
 * lecture) : bannière de l'épisode/film + barre de chargement. Remplace
 * l'ancien splash animé « poulpe TENTACLE ».
 *
 * Posé sur le backdrop de l'épisode/film → couleurs volontairement en dur
 * (text-white, scrim bg-black) dans les deux thèmes clair/sombre.
 */
export function PlayerLoadingScreen({ posterUrl, title, subtitle, onCancel }: PlayerLoadingScreenProps) {
  const { t } = useTranslation("player");

  useEffect(() => {
    if (!onCancel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

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

      {/* La sortie — au coin haut-gauche, là où le lecteur posera la sienne. */}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("player:back")}
          // Le focus lui revient d'emblée : c'est la seule chose à faire sur
          // cet écran. Au clavier, Entrée suffit donc ; sur le téléviseur LG,
          // qui rend cette même page, c'est ce qui la rend pilotable du tout —
          // sans focus, une télécommande n'a aucune prise.
          autoFocus
          className="absolute left-4 top-4 z-10 flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-black/45 px-5 text-sm font-semibold text-white transition-colors hover:bg-black/70 md:left-8 md:top-8"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t("player:back")}
        </button>
      )}

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
