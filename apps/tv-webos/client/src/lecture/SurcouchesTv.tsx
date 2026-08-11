import type { ComponentProps } from "react";
import { VideoPlayerOverlays as SurcouchesWeb } from "@/components/player/VideoPlayerOverlays?original";
import { BoutonsSautTv } from "./BoutonSautTv";
import { IndicateurChargementTv } from "./IndicateurChargementTv";

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

  return (
    <>
      <SurcouchesWeb {...props} showSkipIntro={null} showSkipCredits={null} />
      {/* Le spinner du web fait quarante-huit pixels : lisible sur un moniteur,
          invisible à trois mètres. Celui-ci prend le relais une fois la lecture
          commencée, et couvre en plus le rechargement de la veille de gel, qui
          coupait l'image sans rien dire. */}
      <IndicateurChargementTv loading={props.loading} aDemarre={props.aDemarre} />
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
