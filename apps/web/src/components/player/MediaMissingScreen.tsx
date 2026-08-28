import { useTranslation } from "react-i18next";

/**
 * Le fichier local a disparu : écran dédié, à la place du lecteur.
 *
 * C'est une erreur de MÉDIA — mpv n'y est pour rien, la bascule de secours
 * n'est PAS mémorisée et le lecteur natif reste celui des médias suivants.
 * « Réessayer » re-résout la source (fichier revenu → local ; disparu →
 * streaming si le serveur est joignable) ; « Retour » rend la fiche.
 *
 * Même canevas que `DesktopPlayerFallback` : fond noir plein écran, la
 * surface prolonge le letterboxing, elle n'est pas de l'interface.
 */
export function MediaMissingScreen({ onRetry, onBack }: { onRetry: () => void; onBack: () => void }) {
  const { t } = useTranslation("player");
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-black px-8 text-center">
      <p className="text-lg font-semibold text-white">{t("player:mediaMissingTitle")}</p>
      <p className="max-w-xl text-sm text-white/70">{t("player:mediaMissingHint")}</p>
      <div className="mt-2 flex gap-3">
        <button
          onClick={onRetry}
          className="h-11 rounded-lg bg-white px-5 font-bold text-black hover:bg-white/90"
        >
          {t("player:retry")}
        </button>
        <button
          onClick={onBack}
          className="h-11 rounded-lg bg-white/10 px-5 font-bold text-white hover:bg-white/20"
        >
          {t("common:back")}
        </button>
      </div>
    </div>
  );
}
