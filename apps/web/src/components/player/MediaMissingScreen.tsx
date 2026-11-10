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
 * surface prolonge le letterboxing, elle n'est pas de l'interface. Ses boutons
 * sont des pilules en dur (ivoire, voile clair) : les jetons du thème s'inversent
 * en clair, et ce canevas reste noir.
 */
export function MediaMissingScreen({ onRetry, onBack }: { onRetry: () => void; onBack: () => void }) {
  const { t } = useTranslation("player");
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-black px-8 text-center">
      <p className="font-display text-xl font-semibold tracking-tight text-white">{t("player:mediaMissingTitle")}</p>
      <p className="max-w-xl text-sm text-white/70">{t("player:mediaMissingHint")}</p>
      <div className="mt-2 flex gap-3">
        <button type="button" onClick={onRetry} className="flex min-h-11 items-center rounded-pill bg-[#F4F2EE] px-6 text-sm font-bold text-[#131315] transition-[background-color,transform] duration-hover hover:bg-white active:scale-[0.97]">
          {t("player:retry")}
        </button>
        <button type="button" onClick={onBack} className="flex min-h-11 items-center rounded-pill bg-[rgba(255,255,255,0.14)] px-6 text-sm font-semibold text-white transition-[background-color,transform] duration-hover hover:bg-[rgba(255,255,255,0.22)] active:scale-[0.97]">
          {t("common:back")}
        </button>
      </div>
    </div>
  );
}
