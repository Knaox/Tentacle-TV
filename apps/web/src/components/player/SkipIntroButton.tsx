import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DEPART_SAUT_INTRO } from "./sautIntro";

interface SkipIntroButtonProps {
  /** Secondes restantes avant le saut automatique, `null` s'il n'est pas armé. */
  compte: number | null;
  /** Le saut — clic sur la pilule, ou fin du décompte. */
  onSauter: () => void;
  /** Refuser le saut automatique pour cet épisode. */
  onAnnuler: () => void;
  /** Couche d'empilement : `z-50` sur le web, `z-20` sur le bureau. */
  couche: string;
  /**
   * Flou d'arrière-plan. Le lecteur de bureau l'interdit : mpv peint hors du
   * moteur web, le flou ne floute rien et coûte une couche composée par image.
   */
  flou?: boolean;
}

/**
 * La pilule « Passer l'intro », dans ses deux états.
 *
 * Le langage du lecteur est déjà fixé : c'est la MÊME pilule qu'avant, au même
 * endroit, avec le même poids. Le saut automatique n'y ajoute que trois choses
 * — le libellé qui compte, une glissière qui court, une croix pour s'y opposer.
 *
 * Annuler ne retire pas le bouton : il retombe sur « Passer l'intro ». Refuser
 * que la lecture décide seule n'est pas refuser de passer l'intro.
 */
export function SkipIntroButton({
  compte, onSauter, onAnnuler, couche, flou,
}: SkipIntroButtonProps) {
  const { t } = useTranslation("player");
  const arme = compte !== null;

  return (
    <div className={`absolute bottom-28 right-6 flex items-center gap-2 ${couche}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSauter(); }}
        className={`relative overflow-hidden rounded-lg border border-white/20 bg-black/60 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/20 ${flou ? "backdrop-blur-md" : ""}`}
      >
        {arme ? t("player:skipIntroIn", { seconds: compte }) : t("player:skipIntro")}
        {arme && <Glissiere />}
      </button>
      {arme && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAnnuler(); }}
          aria-label={t("player:dismiss")}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/85 transition-colors hover:bg-black/80 hover:text-white"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * Le temps qui reste, montré plutôt que lu — la seconde qui s'écoule se voit du
 * coin de l'œil, là où un chiffre demande qu'on le lise.
 *
 * `scaleX` et rien d'autre : animer `width` repeindrait la pilule à chaque
 * image. Le premier rendu la pose à zéro, l'image suivante lance la transition.
 * Sous « animations réduites », elle disparaît et le libellé fait seul le
 * travail.
 */
function Glissiere() {
  const [parti, setParti] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setParti(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <span
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-white/70 transition-transform ease-linear motion-reduce:hidden"
      style={{
        transitionDuration: `${DEPART_SAUT_INTRO}s`,
        transform: `scaleX(${parti ? 1 : 0})`,
      }}
    />
  );
}
