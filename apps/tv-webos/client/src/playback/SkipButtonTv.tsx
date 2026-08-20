import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { SegmentTimestamps } from "@tentacle-tv/shared";
import { donnerFocus } from "../focus/active";
import { lireEtat, useEtatLecteurTv } from "@tentacle-tv/tv-core";
import { poserFocusOsd } from "./focusOsd";
import { useDecompteSautIntro } from "./sautIntroAuto";
import { ATTRIBUT_SURCOUCHE } from "./okOverlay";

/**
 * « Passer l'intro », « Passer le générique ».
 *
 * Le client web les rend déjà, et ce sont de vrais boutons — mais deux choses
 * les rendaient inutilisables sur une dalle.
 *
 * **Ils étaient hors cadre.** Ancrés à vingt-quatre pixels du bord droit, dans
 * les soixante-quatre que l'overscan d'un téléviseur mange. Le lecteur annule
 * le retrait posé sur `#root` — il rend sa racine en plein écran — et chaque
 * surcouche doit donc reprendre ce retrait à son compte, comme le font déjà
 * l'habillage et l'écran de déplacement.
 *
 * **Ils étaient inatteignables.** L'habillage s'éteint au bout de cinq
 * secondes, et avec lui le moteur de focus se retire de la route : les flèches
 * appartiennent alors au déplacement dans le flux. Un bouton qui paraît à ce
 * moment-là n'a donc aucun moyen d'être visé.
 *
 * La parade est celle d'`apps/tv`, et elle est plus économe qu'il n'y paraît :
 * le bouton PREND le focus en paraissant, et les flèches gardent leur sens. Un
 * seul geste change de propriétaire, OK — ce qui suffit, puisqu'il n'y a qu'une
 * chose à faire d'un bouton « passer ».
 */

interface ProprietesSaut {
  visible: boolean;
  segment: SegmentTimestamps | null | undefined;
  libelle: string;
  onSauter: (secondes: number) => void;
  /** Secondes restantes du saut automatique, `null` s'il n'est pas armé. */
  compte?: number | null;
  /** Refuser le saut automatique pour ce passage sur l'intro. */
  onAnnuler?: () => void;
}

function BoutonSaut({ visible, segment, libelle, onSauter, compte = null, onAnnuler }: ProprietesSaut) {
  const bouton = useRef<HTMLButtonElement>(null);
  const etat = useEtatLecteurTv();

  /**
   * Rien pendant le déplacement.
   *
   * L'écran du curseur fantôme est plein cadre — vignette, horodatage, palier —
   * et c'est un mode : on y cherche une position, pas une action. Un bouton
   * « passer l'intro » posé par-dessus propose de partir ailleurs au moment où
   * l'on vise, et il traverse au passage la seule chose qu'on regarde.
   */
  const affiche = visible && !!segment && etat.mode !== "scrub";

  useEffect(() => {
    const element = bouton.current;
    if (!affiche || !element) return;

    /**
     * Le bouton ne prend le focus que si personne d'autre ne s'en sert.
     *
     * Habillage éteint, il est la seule chose à l'écran : le prendre est le
     * seul moyen de le viser, puisque le moteur s'est retiré de la route.
     *
     * Habillage AFFICHÉ, non — l'anneau est quelque part dans la rangée, sous
     * les yeux et sous le doigt, et le lui arracher pour le poser dans un coin
     * de l'écran déplacerait la main de l'utilisateur sans qu'il l'ait demandé.
     * Le bouton reste atteignable au D-pad : les flèches parcourent tout ce qui
     * est à l'écran, ce coin-là compris.
     */
    if (lireEtat().mode === "repos") donnerFocus(element);

    return () => {
      // Le bouton disparaît avec le segment — ou parce qu'on vient de l'user.
      // S'il tenait le focus, le laisser sur un nœud démonté priverait la
      // télécommande de toute cible.
      if (document.activeElement !== element) return;
      element.blur();

      // Et s'il y a un habillage à l'écran, c'est là que la main doit revenir :
      // sur la commande qu'on visait avant de partir dans le coin, ou à défaut
      // sur Lecture. Sans cela, le focus retombe sur le corps du document et le
      // moteur le repose où l'ordre de lecture veut bien.
      poserFocusOsd(document.querySelector<HTMLElement>(".osd-tv"));
    };
  }, [affiche]);

  if (!affiche || !segment) return null;

  const sauter = (
    <button
      ref={bouton}
      type="button"
      className="saut-tv"
      {...{ [ATTRIBUT_SURCOUCHE]: "" }}
      onClick={(evenement) => {
        evenement.stopPropagation();
        onSauter(segment.end);
      }}
    >
      {libelle}
    </button>
  );

  // Hors décompte, le bouton reste exactement ce qu'il était : seul, à sa
  // place. L'îlot n'apparaît que le temps des trois secondes.
  if (compte === null || !onAnnuler) return sauter;

  return (
    <div className="saut-tv-ilot">
      {sauter}
      <BoutonRefus onAnnuler={onAnnuler} />
    </div>
  );
}

/**
 * Le refus, à côté du saut.
 *
 * Pas une croix : à trois mètres, on ne vise pas une cible de trente-deux
 * pixels. Un second bouton, que les flèches atteignent depuis le premier — et
 * qui ne paraît que pendant le décompte, pour ne pas encombrer un écran où il
 * n'y a rien à refuser.
 */
function BoutonRefus({ onAnnuler }: { onAnnuler: () => void }) {
  const { t } = useTranslation("player");
  return (
    <button
      type="button"
      className="saut-tv saut-tv--refus"
      {...{ [ATTRIBUT_SURCOUCHE]: "" }}
      onClick={(evenement) => {
        evenement.stopPropagation();
        onAnnuler();
      }}
    >
      {t("player:dismiss")}
    </button>
  );
}

interface ProprietesSauts {
  showSkipIntro: boolean | null | undefined;
  showSkipCredits: boolean | null | undefined;
  introSegment?: SegmentTimestamps | null;
  creditsSegment?: SegmentTimestamps | null;
  autoPlayCountdown: number | null;
  hasNextEpisode?: boolean;
  handleSeek: (secondes: number) => void;
}

export function BoutonsSautTv({
  showSkipIntro,
  showSkipCredits,
  introSegment,
  creditsSegment,
  autoPlayCountdown,
  hasNextEpisode,
  handleSeek,
}: ProprietesSauts) {
  const { t } = useTranslation("player");

  // Le saut automatique ne concerne que l'intro : ce qui suit un générique,
  // c'est l'épisode d'après, et la carte « à suivre » a son propre décompte.
  const sautIntro = useDecompteSautIntro({
    visible: !!showSkipIntro && !!introSegment,
    sauter: () => { if (introSegment) handleSeek(introSegment.end); },
  });

  return (
    <>
      <BoutonSaut
        visible={sautIntro.montrer}
        segment={introSegment}
        libelle={
          sautIntro.compte !== null
            ? t("player:skipIntroIn", { seconds: sautIntro.compte })
            : t("player:skipIntro")
        }
        onSauter={handleSeek}
        compte={sautIntro.compte}
        onAnnuler={sautIntro.annuler}
      />
      {/* Réservé au cas où il n'y a RIEN après : quand un épisode suit, c'est
          la carte « à suivre » qui prend sa place — avec la vignette et le
          titre, de quoi décider plutôt qu'un simple libellé. La condition est
          celle du client web, reprise telle quelle. */}
      <BoutonSaut
        visible={!!showSkipCredits && !autoPlayCountdown && !hasNextEpisode}
        segment={creditsSegment}
        libelle={t("player:skipCredits")}
        onSauter={handleSeek}
      />
    </>
  );
}

