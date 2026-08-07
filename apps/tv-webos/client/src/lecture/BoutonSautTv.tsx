import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { SegmentTimestamps } from "@tentacle-tv/shared";
import { donnerFocus } from "../focus/actif";
import { lireEtat } from "./etatLecteurTv";

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

/** Ce que le contrôleur de touches cherche pour savoir à qui appartient OK. */
export const ATTRIBUT_SAUT = "data-osd-saut";

interface ProprietesSaut {
  visible: boolean;
  segment: SegmentTimestamps | null | undefined;
  libelle: string;
  onSauter: (secondes: number) => void;
}

function BoutonSaut({ visible, segment, libelle, onSauter }: ProprietesSaut) {
  const bouton = useRef<HTMLButtonElement>(null);
  const affiche = visible && !!segment;

  useEffect(() => {
    const element = bouton.current;
    if (!affiche || !element) return;

    // On ne prend le focus que si personne d'autre ne s'en sert : l'habillage
    // visible a ses propres boutons, et le moteur les parcourt très bien.
    if (lireEtat().mode === "repos") donnerFocus(element);

    return () => {
      // Le bouton disparaît avec le segment. S'il tenait le focus, le laisser
      // sur un nœud démonté priverait la télécommande de toute cible.
      if (document.activeElement === element) element.blur();
    };
  }, [affiche]);

  if (!affiche || !segment) return null;

  return (
    <button
      ref={bouton}
      type="button"
      className="saut-tv"
      {...{ [ATTRIBUT_SAUT]: "" }}
      onClick={(evenement) => {
        evenement.stopPropagation();
        onSauter(segment.end);
      }}
    >
      {libelle}
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

  return (
    <>
      <BoutonSaut
        visible={!!showSkipIntro}
        segment={introSegment}
        libelle={t("player:skipIntro")}
        onSauter={handleSeek}
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

/**
 * Active le bouton « passer » s'il tient le focus.
 *
 * Rend `false` quand ce n'est pas le cas — l'appelant reprend alors son cours.
 */
export function activerSautFocalise(): boolean {
  const actif = document.activeElement;
  if (!(actif instanceof HTMLElement) || !actif.hasAttribute(ATTRIBUT_SAUT)) return false;
  actif.click();
  return true;
}
