import { useTranslation } from "react-i18next";
import type { PlaybackFailure } from "../../hooks/playbackFailure";

/**
 * Les deux toiles plein écran du lecteur desktop : l'erreur mpv, et l'attente
 * avant que le lecteur ne soit prêt.
 *
 * Extraites de `DesktopPlayer` (limite de 300 lignes par fichier). Elles vont
 * ensemble : ce sont les deux états où il n'y a pas encore d'image, et où la page
 * occupe seule l'écran.
 *
 * `bg-black` et `text-white` en dur dans les deux thèmes, comme le canevas vidéo
 * lui-même : ces surfaces prolongent le letterboxing, elles ne sont pas de
 * l'interface.
 */

export function DesktopPlayerError({ failure, onBack }: { failure: PlaybackFailure; onBack: () => void }) {
  const { t } = useTranslation("player");
  const message = failure.messageKey
    ? t(failure.messageKey)
    : t("player:mpvError", { error: failure.detail ?? "?" });
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-black">
      <p className="text-lg text-red-400">{message}</p>
      <button
        onClick={onBack}
        className="h-11 rounded-lg bg-white px-5 font-bold text-black hover:bg-white/90"
      >
        {t("common:back")}
      </button>
    </div>
  );
}

export function DesktopPlayerLoading({ posterUrl }: { posterUrl?: string }) {
  return (
    <div className="relative flex h-screen w-screen items-center justify-center bg-black">
      {posterUrl && <img src={posterUrl} className="absolute inset-0 h-full w-full object-cover" alt="" />}
      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
        {/* Blanc et non violet : posé sur l'affiche assombrie du média, il doit
            rester neutre et lisible quelle que soit la couleur derrière — même
            recette que les spinners de buffering des overlays. */}
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
      </div>
    </div>
  );
}
