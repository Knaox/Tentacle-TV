import { useEffect, useState } from "react";

interface UpNextCardState {
  /** Faut-il monter la carte « à suivre » ? */
  visible: boolean;
  /**
   * Secondes restantes, ou `null` quand la carte est une simple proposition —
   * affichée pendant le générique sans qu'aucun enchaînement ne soit lancé.
   */
  countdown: number | null;
  /** L'utilisateur referme la carte : elle ne revient plus sur cet épisode. */
  dismiss: () => void;
}

interface UpNextCardOptions {
  /** Épisode en cours — sert à réarmer la carte quand on change de vidéo. */
  itemId: string | undefined;
  hasNextEpisode: boolean | undefined;
  /** Vrai pendant le générique de fin. */
  duringCredits: boolean | null | undefined;
  /** Décompte de l'enchaînement automatique, `null` s'il n'est pas lancé. */
  autoPlayCountdown: number | null;
}

/**
 * Quand montrer la carte « à suivre », et sous quelle forme — partagé par les
 * deux moteurs de lecture (web HLS et desktop mpv), qui affichaient jusqu'ici
 * deux traitements différents du même moment.
 *
 * Ce que cela remplace : pendant le générique, un simple BOUTON « Épisode
 * suivant » ; la carte n'arrivait qu'une fois l'enchaînement automatique
 * déclenché. Dès lors que la métadonnée de l'épisode suivant existe, c'est la
 * carte qui s'affiche — avec sa vignette et son titre, de quoi décider — et le
 * bouton ne subsiste que pour « passer le générique », quand il n'y a
 * justement rien après.
 *
 * Deux états, un seul composant :
 *   • pendant le générique, `countdown` vaut `null` : ni compte à rebours ni
 *     barre de progression, la carte attend un clic et n'annonce aucune
 *     échéance ;
 *   • si l'enchaînement automatique démarre ensuite, le décompte s'y allume,
 *     sans que la carte n'ait à être remontée.
 *
 * Le rejet est mémorisé par ÉPISODE : refermer la carte la fait taire pour la
 * fin de la vidéo en cours, mais elle se réarme au suivant — sans quoi un seul
 * refus vaudrait pour toute une saison.
 */
export function useUpNextCard({
  itemId,
  hasNextEpisode,
  duringCredits,
  autoPlayCountdown,
}: UpNextCardOptions): UpNextCardState {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [itemId]);

  const counting = autoPlayCountdown !== null;
  // Le décompte l'emporte sur le rejet : si l'enchaînement automatique est
  // lancé, l'utilisateur doit pouvoir l'interrompre — masquer la carte lui
  // retirerait le seul moyen de le faire.
  const visible = counting || Boolean(duringCredits && hasNextEpisode && !dismissed);

  return {
    visible,
    countdown: counting ? autoPlayCountdown : null,
    dismiss: () => setDismissed(true),
  };
}
