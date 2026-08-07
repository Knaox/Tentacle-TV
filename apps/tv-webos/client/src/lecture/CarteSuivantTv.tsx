import { useEffect, useRef } from "react";
import { UpNextCard } from "@/components/player/UpNextCard";
import { donnerFocus } from "../focus/actif";
import { destinationEntreeDeZone } from "../focus/zones";
import { lireEtat } from "./etatLecteurTv";
import { ATTRIBUT_SURCOUCHE } from "./surcoucheOk";

/**
 * La carte « épisode suivant ».
 *
 * **Le comportement est déjà celui d'`apps/tv`, et il vient du client web.**
 * Seuil de déclenchement à `durée × maxResumePct / 100`, décompte de dix
 * secondes au tic d'une seconde, un seul déclenchement par épisode, fermeture
 * qui vaut annulation : `useAutoNextCountdown` fait exactement ce que fait
 * `useAutoPlay` là-bas. Il n'y avait rien à réécrire.
 *
 * Ce qui manquait est ce qui manquait aux boutons « passer » — et pour les
 * mêmes deux raisons.
 *
 * **Le cadre.** La carte du web s'ancre à seize pixels du coin, dans les
 * soixante-quatre que l'overscan d'un téléviseur mange. On lui rend son flux et
 * l'enveloppe reprend la géométrie, comme pour les panneaux.
 *
 * **La portée.** Elle paraît à la fin de l'épisode, donc bien après que
 * l'habillage se soit éteint et que le moteur de focus se soit retiré de la
 * route. Elle prend donc le focus, sur son appel à l'action — que la cascade
 * d'entrée du moteur désigne toute seule, `cta-primary` étant son deuxième
 * rang.
 *
 * Le `backdrop-filter` en ligne de la carte n'est pas neutralisé : Chrome 53 ne
 * le connaît pas et l'ignore. C'est sur un moteur récent qu'il coûterait, et
 * aucun n'est en jeu ici.
 */

interface ProprietesCarte {
  countdown: number | null;
  episodeTitle?: string;
  episodeDescription?: string;
  episodeImageUrl?: string;
  episodeLabel?: string;
  onPlay: () => void;
  onCancel: () => void;
}

export function AutoPlayOverlay({
  countdown,
  episodeTitle,
  episodeDescription,
  episodeImageUrl,
  episodeLabel,
  onPlay,
  onCancel,
}: ProprietesCarte) {
  const enveloppe = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const racine = enveloppe.current;
    if (!racine) return;

    // Comme pour les boutons « passer » : on ne prend le focus que si personne
    // d'autre ne s'en sert. Habillage visible, le moteur fait déjà son travail.
    if (lireEtat().mode === "repos") {
      const cible = destinationEntreeDeZone(racine);
      if (cible) donnerFocus(cible);
    }

    return () => {
      if (racine.contains(document.activeElement)) {
        const actif = document.activeElement;
        if (actif instanceof HTMLElement) actif.blur();
      }
    };
  }, []);

  return (
    <div className="carte-suivant-tv" ref={enveloppe} {...{ [ATTRIBUT_SURCOUCHE]: "" }}>
      <UpNextCard
        countdown={countdown}
        episodeTitle={episodeTitle}
        episodeDescription={episodeDescription}
        episodeImageUrl={episodeImageUrl}
        episodeLabel={episodeLabel}
        onPlay={onPlay}
        onDismiss={onCancel}
      />
    </div>
  );
}
