import { useEffect, useRef } from "react";
import { UpNextCard } from "@/components/player/UpNextCard";
import { NextEpisodeFullscreen } from "@/components/player/NextEpisodeFullscreen";
import { donnerFocus } from "../focus/actif";
import { destinationEntreeDeZone } from "../focus/zones";
import { ATTRIBUT_SURCOUCHE } from "./surcoucheOk";

/**
 * Ce qui s'affiche à la fin d'un épisode.
 *
 * **Deux formes, comme sur le bureau.** Pendant le générique, une simple
 * proposition : la bannière `UpNextCard`, dans un coin, qui n'annonce aucune
 * échéance. À la fin réelle, quand l'enchaînement automatique est lancé,
 * l'affiche PLEIN ÉCRAN — fond de série assombri, vignette de l'épisode
 * suivant, résumé, décompte cerclé. C'est ce que fait `DesktopPlayerOverlays`
 * (bannière, puis plein écran quand la source est l'EOF), et c'est ce qui
 * manquait ici : le téléviseur n'avait jamais que la bannière.
 *
 * Le partage se lit sur `countdown` : `null` tant que rien n'est lancé, un
 * nombre dès que le décompte tourne. Aucune condition de plateforme à écrire —
 * `useUpNextCard` publie déjà exactement cette distinction.
 *
 * **On enveloppe, on ne recopie pas.** Les deux composants viennent du client
 * web tels quels ; ce qui change ici est le cadre et la portée.
 *
 * **Le cadre.** La bannière du web s'ancre à seize pixels du coin, dans les
 * soixante-quatre que l'overscan d'un téléviseur mange. On lui rend son flux et
 * l'enveloppe reprend la géométrie, comme pour les panneaux. L'affiche plein
 * écran, elle, occupe déjà tout : elle n'a besoin que du retrait d'overscan.
 *
 * **La portée.** Elle paraît à la fin de l'épisode, donc bien après que
 * l'habillage se soit éteint et que le moteur de focus se soit retiré de la
 * route. Elle prend donc le focus — et sur l'affiche plein écran, sur « Lire
 * maintenant » plutôt que sur la croix de fermeture, qui la précède dans le
 * document.
 *
 * Le `backdrop-filter` en ligne des deux composants n'est pas neutralisé :
 * Chrome 53 ne le connaît pas et l'ignore. C'est sur un moteur récent qu'il
 * coûterait, et aucun n'est en jeu ici.
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

/**
 * L'appel à l'action de l'affiche, et non sa croix de fermeture.
 *
 * Distinction structurelle : la croix est posée en absolu sur la racine, tandis
 * que les boutons du panneau central sont plus profonds. Viser le premier
 * focusable en ordre de document désignerait donc la fermeture — la seule
 * chose qu'on ne veuille pas proposer quand on offre la suite.
 */
function actionPrincipale(racine: HTMLElement): HTMLElement | null {
  for (const bouton of racine.querySelectorAll<HTMLElement>("button")) {
    if (bouton.parentElement !== racine) return bouton;
  }
  return null;
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
  const pleinEcran = countdown !== null;

  useEffect(() => {
    const racine = enveloppe.current;
    if (!racine) return;

    // La surcouche prend le focus en paraissant, habillage compris : les
    // flèches se taisent dès qu'elle est là, ne pas le prendre la rendrait
    // inatteignable.
    const cible = (pleinEcran ? actionPrincipale(racine) : null) ?? destinationEntreeDeZone(racine);
    if (cible) donnerFocus(cible);

    return () => {
      if (racine.contains(document.activeElement)) {
        const actif = document.activeElement;
        if (actif instanceof HTMLElement) actif.blur();
      }
    };
  }, [pleinEcran]);

  if (pleinEcran) {
    return (
      <div className="affiche-fin-tv" ref={enveloppe} {...{ [ATTRIBUT_SURCOUCHE]: "" }}>
        <NextEpisodeFullscreen
          countdown={countdown}
          episodeTitle={episodeTitle}
          episodeLabel={episodeLabel}
          episodeDescription={episodeDescription}
          // Le lecteur ne transmet pas la bannière de la SÉRIE — le chemin qui
          // la porte est celui du bureau. La vignette de l'épisode suivant fait
          // un fond tout aussi juste : elle est assombrie à 0,72 par le
          // composant, et c'est bien de cet épisode-là qu'on parle.
          seriesBackdropUrl={episodeImageUrl}
          episodeThumbUrl={episodeImageUrl}
          onPlayNow={onPlay}
          onDismiss={onCancel}
        />
      </div>
    );
  }

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
