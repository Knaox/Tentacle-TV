import { useEffect, useState } from "react";
import { useAutoNextCountdown as useAutoNextCountdownWeb } from "@/hooks/useAutoNextCountdown?original";
import { useDecompteEnchainement } from "@/hooks/useEnchainementEpisode";

/**
 * Le filet qui garantit la carte « à suivre » à la toute fin.
 *
 * **Ce qui manquait.** La carte paraît à deux conditions, et aucune n'est
 * garantie : pendant le générique — ce qui suppose un segment « Outro »
 * DÉCLARÉ dans Jellyfin, or beaucoup de bibliothèques n'en ont aucun —, ou
 * quand l'enchaînement automatique démarre au `maxResumePct`. Ce second
 * déclenchement ne joue **qu'une fois par épisode** (`creditsAutoPlayTriggered`)
 * et ne dépend que de `currentTime` : un déplacement rapide qui franchit le
 * seuil pendant que la vidéo est en pause, un rejet plus tôt dans l'épisode, un
 * pourcentage jamais atteint parce qu'on a sauté directement à la fin — et
 * l'épisode se termine sans que rien ne soit proposé.
 *
 * Sur un écran d'ordinateur, on referme l'onglet. Dans un salon, la
 * télécommande est à trois mètres et l'on attend que l'appareil propose la
 * suite : c'est le moment où l'interface doit être là.
 *
 * **On enveloppe, on ne recopie pas.** Le hook du web garde tout son
 * comportement — seuil, décompte, annulation. On n'ajoute qu'un filet : arrivé
 * aux dernières secondes avec un épisode suivant, la carte paraît, quelles que
 * soient les circonstances qui l'en ont empêchée jusque-là.
 *
 * Le filet est délibérément INCONDITIONNEL sur le rejet : quelqu'un qui a
 * masqué la carte à mi-épisode ne l'a pas fait pour l'écran de fin, et c'est le
 * dernier instant où elle sert encore à quelque chose. Il ne peut de toute
 * façon rien déclencher qu'on n'ait demandé — `startAutoPlay` se tait s'il n'y
 * a pas d'épisode suivant.
 */

/**
 * À quelle distance de la fin le filet se déclenche.
 *
 * Assez tôt pour que le décompte ait un sens, assez tard pour ne jamais
 * concurrencer le déclenchement normal du `maxResumePct` — qui est à 90 % ou
 * plus, donc à plusieurs minutes de là sur un épisode.
 */
const FIN_S = 6;

type OptionsWeb = Parameters<typeof useAutoNextCountdownWeb>[0];

export function useAutoNextCountdown(options: OptionsWeb) {
  const resultat = useAutoNextCountdownWeb(options);
  const { autoPlayCountdown, startAutoPlay } = resultat;
  const { duration, currentTime, hasNextEpisode, onNextEpisode } = options;

  /**
   * Le décompte éteint ne doit pas emporter l'AFFICHE DE FIN.
   *
   * Ici, la carte et l'affiche partagent une seule monture — c'est
   * `NextCardTv` qui choisit laquelle rendre, selon que l'épisode est arrivé au
   * bout. Cette monture est gouvernée par `useUpNextCard`, qui ne la montre
   * qu'à la faveur d'un décompte ou d'un générique déclaré. Sans le drapeau
   * ci-dessous, éteindre l'enchaînement automatique laisserait donc la LG sur
   * une image arrêtée, sans rien pour lancer la suite.
   *
   * On distingue donc les deux moitiés du filet : ARMER l'enchaînement quand il
   * est autorisé, PROPOSER la suite quand il ne l'est pas.
   */
  const decompteAutorise = useDecompteEnchainement();
  const [propositionFinale, poserProposition] = useState(false);

  useEffect(() => {
    if (autoPlayCountdown !== null) return;
    if (!hasNextEpisode || !onNextEpisode) return;
    if (!(duration > 0)) return;
    if (currentTime < duration - FIN_S) {
      // Retour en arrière avant la fin (rembobinage, changement d'épisode) :
      // l'affiche n'a plus lieu d'être.
      if (propositionFinale) poserProposition(false);
      return;
    }
    if (decompteAutorise) startAutoPlay();
    else poserProposition(true);
  }, [
    autoPlayCountdown, currentTime, duration, hasNextEpisode, onNextEpisode,
    startAutoPlay, decompteAutorise, propositionFinale,
  ]);

  return { ...resultat, propositionFinale };
}
