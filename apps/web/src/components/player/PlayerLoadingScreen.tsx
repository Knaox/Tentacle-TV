import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";

/**
 * Barre de chargement indéterminée (segment qui glisse). Repli accessible :
 * sous `prefers-reduced-motion`, barre pleine en pulsation douce plutôt qu'un
 * mouvement continu. Réutilisée par l'écran de chargement et l'overlay player.
 *
 * Toujours posée sur un backdrop/vidéo → bg-white/10 volontairement en dur.
 *
 * Le segment est IVOIRE, plus un dégradé de marque (refonte de nov. 2026) : une
 * attente ne se mesure pas — le dégradé de jauge est réservé à ce qui se mesure.
 */
export function LoadingBar({ className = "" }: { className?: string }) {
  return (
    <div className={`relative h-[3px] w-full overflow-hidden rounded-full bg-white/10 ${className}`}>
      <div className="absolute inset-y-0 left-0 w-1/4 rounded-full bg-[#F4F2EE] animate-loading-bar motion-reduce:w-full motion-reduce:animate-pulse motion-reduce:opacity-60" />
    </div>
  );
}

/**
 * La sortie des écrans de chargement : une pilule « Retour » au coin haut-gauche.
 *
 * Une seule pour toute l'attente, au pixel près au même endroit. La page
 * d'attente la pose avant que le lecteur existe, et le lecteur de bureau la
 * reprend tant qu'il n'a pas d'image : préparation de mpv
 * (`DesktopPlayerLoading`), puis ouverture du flux et réserve
 * (`DesktopPlayerOverlays`). Son habillage est retiré pendant ce temps ; sans
 * elle, la sortie disparaissait au montage du lecteur, et l'attente la plus
 * longue — celle du serveur — n'en avait plus aucune à l'écran.
 *
 * `z-20` : dans le lecteur de bureau, l'habillage (`z-10`) reste posé pendant
 * le chargement, effacé mais toujours cliquable. En dessous, la pilule perdait
 * ses clics au profit d'une barre invisible.
 *
 * Posée sur l'affiche ou sur le noir → couleurs en dur dans les deux thèmes.
 */
export function LoadingBackButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation("player");
  return (
    <button
      type="button"
      onClick={() => onClick()}
      aria-label={t("player:back")}
      // Le focus lui revient d'emblée : c'est la seule chose à faire sur ces
      // écrans. Au clavier, Entrée suffit donc ; sur le téléviseur LG, qui rend
      // la page d'attente, c'est ce qui la rend pilotable du tout — sans focus,
      // une télécommande n'a aucune prise.
      autoFocus
      // L'encre des capsules du lecteur (`chrome/playerChrome.css`), en utilitaires : la page
      // d'attente est aussi rendue par le client LG, qui ne compile pas cette feuille.
      className="absolute left-4 top-4 z-20 flex min-h-11 items-center gap-2 rounded-pill bg-[rgba(24,24,27,0.74)] pl-4 pr-5 text-sm font-semibold text-white transition-[background-color,transform] duration-hover hover:bg-[#18181B] active:scale-[0.97] md:left-6 md:top-5"
    >
      <ArrowLeftIcon size={18} aria-hidden />
      {t("player:back")}
    </button>
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
   * donc devant une barre qui tourne. Le bouton et la touche Échap sont ici
   * pour cette raison ; le lecteur de bureau reprend le même bouton tant
   * qu'il n'a pas d'image (`LoadingBackButton`).
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
    // L'encre de la page (`#0B0B0C`), sans lavis de marque : la couleur est à l'image qui arrive.
    <div className="relative h-screen w-screen overflow-hidden bg-[#0B0B0C]">
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
      {onCancel && <LoadingBackButton onClick={onCancel} />}

      <div className="absolute inset-x-0 bottom-0 px-8 pb-14 md:px-16 md:pb-20">
        {title && (
          <h1 className="mb-1.5 max-w-3xl truncate font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="mb-6 max-w-3xl truncate text-sm text-white/70 md:text-base">{subtitle}</p>
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
