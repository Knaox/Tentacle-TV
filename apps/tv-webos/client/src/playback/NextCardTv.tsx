import { useEffect, useRef, useState } from "react";
import { UpNextCard } from "@/components/player/UpNextCard";
import { NextEpisodeFullscreen } from "@/components/player/NextEpisodeFullscreen";
import { donnerFocus } from "../focus/active";
import { destinationEntreeDeZone } from "../focus/zones";
import { lireEtat, useEtatLecteurTv } from "@tentacle-tv/tv-core";
import { useDecompteEnchainement } from "@/hooks/useEnchainementEpisode";
import { quitterLecteur } from "./playerExitTv";
import { ATTRIBUT_SURCOUCHE } from "./okOverlay";

/**
 * Ce qui s'affiche à la fin d'un épisode.
 *
 * **Deux formes, comme sur le bureau.** Tant que l'épisode dure — pendant le
 * générique, ou dès que l'enchaînement automatique s'arme au `maxResumePct` de
 * Jellyfin —, une simple proposition dans un coin : la bannière `UpNextCard`.
 * **Au BOUT seulement**, l'affiche PLEIN ÉCRAN : fond assombri, vignette de
 * l'épisode suivant, résumé, décompte cerclé. C'est ce que fait
 * `DesktopPlayerOverlays` (bannière, puis plein écran quand la source est
 * l'EOF), et c'est ce qui manquait ici — le téléviseur n'avait que la bannière.
 *
 * **Le partage tient à la fin réelle, pas au décompte.** L'enchaînement démarre
 * plusieurs minutes avant le bout : s'en servir couvrirait la fin de l'épisode
 * d'une affiche pleine dalle alors qu'il reste des scènes à voir. On interroge
 * donc l'élément vidéo — voir `useLectureTerminee`.
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

/** À quelle distance du bout on considère l'épisode terminé. */
const FIN_S = 1;

/** Le décompte du client web, repris ici pour l'instant où il manque encore. */
const TOTAL_DECOMPTE_S = 10;

/**
 * L'épisode est-il ARRIVÉ AU BOUT ?
 *
 * Ce n'est pas la même question que « l'enchaînement est-il lancé » : celui-ci
 * démarre au `maxResumePct` de Jellyfin, donc plusieurs minutes avant la fin.
 * L'affiche pleine dalle appartient au bout — c'est un écran de fin, pas une
 * proposition anticipée — et la bannière tient ces minutes-là.
 *
 * On interroge l'élément vidéo directement : le lecteur ne transmet ni le temps
 * ni la durée à cette surcouche, et remonter jusqu'à lui demanderait de toucher
 * au client web. `ended` couvre la fin naturelle ; la comparaison couvre le cas
 * qu'on a demandé — arriver au bout en avance rapide.
 */
function useLectureTerminee(): boolean {
  const [terminee, poser] = useState(false);

  useEffect(() => {
    const video = document.querySelector("video");
    if (!video) return;

    const revoir = () => {
      const duree = video.duration;
      poser(video.ended || (duree > 0 && video.currentTime >= duree - FIN_S));
    };

    revoir();
    video.addEventListener("timeupdate", revoir);
    video.addEventListener("ended", revoir);
    return () => {
      video.removeEventListener("timeupdate", revoir);
      video.removeEventListener("ended", revoir);
    };
  }, []);

  return terminee;
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
  const etat = useEtatLecteurTv();
  const decompteAutorise = useDecompteEnchainement();

  /**
   * Arrivé au bout, c'est l'affiche — sans autre condition.
   *
   * Elle a d'abord exigé qu'un décompte tourne, l'affiche en portant un. Mais
   * ce décompte peut manquer au moment précis où l'épisode se termine : on
   * traverse la vidéo en avance rapide, on franchit le seuil pendant que la
   * bannière est là, et le filet de `endCardTv` n'a pas encore rejoué. La
   * bannière restait alors affichée sur un épisode fini — un coin d'écran qui
   * propose la suite devant une image arrêtée.
   *
   * La fin l'emporte donc, et le décompte manquant part de son total : c'est
   * ce que le filet est sur le point de poser.
   */
  const pleinEcran = useLectureTerminee();

  /**
   * Rien pendant le déplacement — sauf si c'est fini.
   *
   * L'écran du curseur fantôme est un mode : on y cherche une position, et une
   * carte posée dans le coin propose de partir ailleurs au moment où l'on vise.
   * Passé le bout, la question ne se pose plus : il n'y a plus de position à
   * chercher, et c'est l'affiche qui a raison.
   */
  const efface = etat.mode === "scrub" && !pleinEcran;

  useEffect(() => {
    const racine = enveloppe.current;
    if (!racine) return;

    // Comme le bouton « passer » : on ne prend le focus que si personne d'autre
    // ne s'en sert. Habillage affiché, l'anneau est déjà sous le doigt dans la
    // rangée — le lui arracher déplacerait la main sans qu'on l'ait demandé.
    //
    // L'affiche PLEINE DALLE fait exception : elle recouvre tout, l'habillage
    // compris. Laisser l'anneau sur un bouton devenu invisible ne servirait
    // personne.
    if (!pleinEcran && lireEtat().mode !== "repos") return;

    const cible = (pleinEcran ? actionPrincipale(racine) : null) ?? destinationEntreeDeZone(racine);
    if (cible) donnerFocus(cible);

    return () => {
      if (racine.contains(document.activeElement)) {
        const actif = document.activeElement;
        if (actif instanceof HTMLElement) actif.blur();
      }
    };
  }, [pleinEcran, efface]);

  if (efface) return null;

  if (pleinEcran) {
    return (
      <div className="affiche-fin-tv" ref={enveloppe} {...{ [ATTRIBUT_SURCOUCHE]: "" }}>
        <NextEpisodeFullscreen
          /**
           * Le total de secours ne vaut que si l'enchaînement est AUTORISÉ.
           *
           * Il existe parce que le décompte peut manquer à l'instant précis où
           * l'épisode se termine — le filet de `endCardTv` n'a pas encore
           * rejoué — et qu'afficher zéro serait faux. Décompte éteint, en
           * revanche, `null` est la valeur juste : l'affiche est une
           * proposition, et n'annonce aucune échéance.
           */
          countdown={decompteAutorise ? (countdown ?? TOTAL_DECOMPTE_S) : null}
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
          /**
           * Refuser la suite, à ce moment-là, c'est en avoir fini.
           *
           * L'épisode est terminé — il ne reste rien à voir derrière l'affiche.
           * La masquer laisserait devant un écran noir, sans commande et sans
           * indication de la marche à suivre. On quitte donc le lecteur, et la
           * pile ramène d'où l'on venait : la fiche de la série, ou l'accueil.
           *
           * `onCancel` d'abord : il interrompt l'enchaînement automatique, qui
           * partirait sinon en pleine sortie.
           */
          onDismiss={() => {
            onCancel();
            quitterLecteur();
          }}
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
