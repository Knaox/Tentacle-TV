import { useState } from "react";

/**
 * Masquer une image qui a échoué — sans le graver dans le DOM.
 *
 * Le réflexe `onError={(e) => e.target.style.display = "none"}` écrit
 * directement dans le nœud, hors du diff de React. Deux conséquences, toutes
 * deux observées : la bannière suivante hérite du masquage, puisque changer
 * `src` ne touche pas à un style que React ne pilote pas ; et une affiche que le
 * serveur a fini par récupérer ne réapparaît jamais.
 *
 * Ici l'échec suit l'ADRESSE. Il se lève de lui-même dès qu'elle change, donc
 * chaque nouvelle image repart avec ses chances intactes.
 */
export function useBrokenImage(src: string | null | undefined) {
  const [state, setState] = useState({ src, broken: false });
  if (state.src !== src) setState({ src, broken: false });

  return {
    broken: state.broken,
    /* Comparaison à l'adresse courante : une erreur qui arrive après un
     * changement de source concerne l'image précédente, pas celle-ci. */
    reportFailure: () => setState((e) => (e.src === src ? { ...e, broken: true } : e)),
  };
}
