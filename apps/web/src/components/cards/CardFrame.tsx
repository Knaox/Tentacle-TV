import type { ReactNode } from "react";

interface CardFrameProps {
  hovered: boolean;
  /** Classe de ratio : `aspect-[2/3]` pour une affiche, `aspect-video` pour une vignette. */
  aspect: string;
  /** Amplitude du lift — la vignette 16:9 étant plus large, elle monte moins. */
  lift?: { scale: number; y: number };
  /**
   * L'élévation répond au survol, mais la carte NE BOUGE PAS.
   *
   * Réservé aux cartes dont un panneau d'aperçu prend le relais : c'est lui qui
   * porte le lift. Sans ce mode, la carte se soulevait dès l'entrée du curseur
   * puis retombait d'un coup à l'ouverture du panneau — deux mouvements
   * contradictoires en moins de deux dixièmes de seconde, ressentis comme une
   * saccade. Ici le fondu croisé des deux calques d'ombre donne une réponse
   * INSTANTANÉE au survol (donc pas d'impression de latence pendant le délai
   * d'ouverture) et le seul déplacement visible est celui du panneau.
   */
  suppressLift?: boolean;
  /**
   * La carte s'efface : un panneau d'aperçu occupe EXACTEMENT sa place et
   * porte la même image.
   *
   * Sans cet effacement, les deux calques restent superposés pendant toute la
   * durée du survol, et le panneau — qui monte de 5 px et grandit de 3 % —
   * laisse dépasser le liseré, l'ombre et les coins de la carte restée en
   * dessous. C'est la seconde moitié de la saccade (la première étant le zoom
   * interne, cf. `CardImage.zoom`) : deux cartes visibles au lieu d'une.
   *
   * `opacity` et non `visibility` / démontage : la boîte doit garder sa place
   * dans la rangée (sinon reflow) ET continuer de recevoir `mouseleave`, qui
   * est ce qui referme le panneau.
   */
  concealed?: boolean;
  children: ReactNode;
}

/**
 * Cadre de survol commun à toutes les cartes média — la signature visuelle du
 * catalogue, définie à UN seul endroit : la carte SORT de la page. Un lift
 * (elle monte et grandit) et une élévation qui passe à `--elev-card-hover`,
 * deux couches d'ombre en fondu croisé. Rien de plus, et surtout AUCUN contour.
 *
 * Le `transform` vit sur le conteneur EXTÉRIEUR pour que tout bouge ensemble.
 *
 * Trois traits de 1 px et un cadre de bruit fractal ont vécu ici, tous retirés
 * ensemble : ils se lisaient comme un contour au lieu de donner de la
 * profondeur. Leur raison d'être n'était pourtant pas décorative — sur un fond
 * noir pur, l'ancienne ombre était invisible et le liseré faisait tout le
 * travail. Deux correctifs structurels la rendent enfin visible, et ils sont
 * indissociables de ce cadre : la carte survolée passe au-dessus de ses
 * voisines (`z-index`, posé par PosterCard et EpisodeCard — sans quoi l'ombre
 * est recouverte par la carte suivante) et le scroller de rangée réserve de
 * quoi laisser passer son débord vers le haut. Le détail de la recette est
 * dans theme/cards.css.
 *
 * Avant eux, DEUX halos de lumière avaient déjà disparu : un halo de ciblage
 * qui reprenait l'affiche floutée derrière la carte, et une tache blanche qui
 * suivait le curseur. Le premier obligeait à monter, sur CHACUNE des ~108
 * cartes de l'accueil, une seconde image portant `filter: blur()` et un masque.
 */
export function CardFrame({
  hovered,
  aspect,
  lift = { scale: 1.06, y: -8 },
  suppressLift = false,
  concealed = false,
  children,
}: CardFrameProps) {
  const moved = hovered && !suppressLift;

  return (
    <div
      // Repère de la transition d'ouverture : c'est CETTE boîte — l'affiche
      // seule, sans le bloc titre qui la suit — que le calque fait voyager
      // jusqu'à la fiche. Capturer la racine de la carte embarquait le titre et
      // l'année, soit un rectangle plus haut que l'image : `object-cover`
      // recadrait alors le visuel pendant tout le trajet.
      data-card-visual
      // `data-hovered` pilote les DEUX calques d'élévation, portés par les
      // pseudo-éléments de `.media-tile` (cf. theme/cards.css). L'ombre n'est
      // pas transitionnée : `box-shadow` est la seule propriété non composable
      // de tout le survol, et l'animer repeignait ~470 000 pixels dix-huit fois
      // de suite, sur une boîte qui se met à l'échelle en même temps — le
      // compositeur ne pouvait donc même pas réutiliser sa texture.
      data-hovered={hovered}
      className="media-tile relative motion-reduce:!transform-none"
      style={{
        transform: moved ? `scale(${lift.scale}) translateY(${lift.y}px)` : "scale(1)",
        opacity: concealed ? 0 : 1,
      }}
    >
      {/* La boîte image. Elle ne porte plus aucun effet de bord : la classe
          `card-spotlight` a disparu avec le biseau qu'elle portait, et le grain
          de pourtour avec elle. */}
      <div className={`relative ${aspect} overflow-hidden rounded-[var(--radius-lg)]`}>
        {children}
      </div>
    </div>
  );
}
