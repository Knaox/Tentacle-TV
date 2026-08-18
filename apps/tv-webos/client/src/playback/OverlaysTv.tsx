import { useSyncExternalStore, type ComponentProps } from "react";
import { VideoPlayerOverlays as SurcouchesWeb } from "@/components/player/VideoPlayerOverlays?original";
import { BoutonsSautTv } from "./SkipButtonTv";
import { abonnerGel, lireGel } from "./freezeStateTv";

/**
 * Les surcouches du lecteur, moins les boutons « passer ».
 *
 * **On enveloppe, on ne recopie pas.** Écran de chargement, barre de
 * progression indéterminée, spinner de mise en mémoire tampon, bouton de
 * démarrage quand la politique d'autoplay bloque, pilule « appuyer pour le
 * son » : tout cela convient tel quel, et le dupliquer serait le laisser
 * diverger.
 *
 * Seuls les deux boutons de saut sont détournés — on passe `null` aux
 * propriétés qui les commandent, et on les rend nous-mêmes. Même motif que la
 * case « appliquer à la série » du panneau des pistes : ce n'est pas le dessin
 * qui pose problème, c'est ce qu'un bouton doit être pour être atteint à la
 * télécommande.
 *
 * Une seule propriété est ENRICHIE : le chargement. Sur le gel propre à cette
 * pile média, le lecteur n'émet aucun événement — cinquante secondes sans un
 * signal, `readyState` à 4 — et son témoin ne peut donc pas s'allumer. La veille
 * de gel, elle, le voit. On lui fait allumer LE cercle qui existe déjà, plutôt
 * que d'ajouter un calque : c'est le second témoin simultané qui avait fait
 * retirer la tentative précédente.
 */
export function VideoPlayerOverlays(props: ComponentProps<typeof SurcouchesWeb>) {
  const {
    showSkipIntro,
    showSkipCredits,
    introSegment,
    creditsSegment,
    autoPlayCountdown,
    hasNextEpisode,
    handleSeek,
  } = props;

  const gele = useSyncExternalStore(abonnerGel, lireGel, lireGel);

  return (
    <>
      <SurcouchesWeb {...props} loading={props.loading || gele} showSkipIntro={null} showSkipCredits={null} />
      <BoutonsSautTv
        showSkipIntro={showSkipIntro}
        showSkipCredits={showSkipCredits}
        introSegment={introSegment}
        creditsSegment={creditsSegment}
        autoPlayCountdown={autoPlayCountdown}
        hasNextEpisode={hasNextEpisode}
        handleSeek={handleSeek}
      />
    </>
  );
}
