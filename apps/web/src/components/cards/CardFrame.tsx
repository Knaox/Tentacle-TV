import type { ReactNode } from "react";
import { CardBloom } from "./CardBloom";
import { useCardSpotlight } from "./useCardSpotlight";

interface CardFrameProps {
  hovered: boolean;
  /** Classe de ratio : `aspect-[2/3]` pour une affiche, `aspect-video` pour une vignette. */
  aspect: string;
  /** Amplitude du lift — la vignette 16:9 étant plus large, elle monte moins. */
  lift?: { scale: number; y: number };
  /**
   * Le liseré et le halo répondent au survol, mais la carte NE BOUGE PAS.
   *
   * Réservé aux cartes dont un panneau d'aperçu prend le relais : c'est lui qui
   * porte le lift. Sans ce mode, la carte se soulevait dès l'entrée du curseur
   * puis retombait d'un coup à l'ouverture du panneau — deux mouvements
   * contradictoires en moins de deux dixièmes de seconde, ressentis comme une
   * saccade. Ici le liseré donne une réponse INSTANTANÉE au survol (donc pas
   * d'impression de latence pendant le délai d'ouverture) et le seul
   * déplacement visible est celui du panneau.
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
  /**
   * Image affichée par la carte — source du halo de ciblage. Absente, la carte
   * n'a pas de halo : c'est l'affiche qui l'éclaire, pas une couleur choisie.
   */
  imageUrl?: string;
  children: ReactNode;
}

/**
 * Cadre de survol commun à toutes les cartes média — la signature visuelle du
 * catalogue, définie à UN seul endroit :
 *
 *  1. un RELIEF de bord au survol : un biseau lumineux (`--card-edge-bevel`,
 *     filet clair en haut, ombre en bas) plus un grain de pourtour
 *     (`.card-grain`). Il a remplacé le liseré dégradé violet → rose : la
 *     couleur, au survol, vient désormais du seul halo `CardBloom` (l'affiche
 *     floutée), et le bord donne du RELIEF plutôt qu'un contour de marque ;
 *  2. le halo de ciblage `CardBloom` (couleurs de l'affiche) ;
 *  3. un halo qui suit le curseur (`useCardSpotlight`, purement CSS) ;
 *  4. un lift à ressort et une élévation qui passe à `--elev-card-hover`.
 *
 * Le `transform` vit sur le conteneur EXTÉRIEUR pour que tout bouge ensemble.
 */
export function CardFrame({
  hovered,
  aspect,
  lift = { scale: 1.04, y: -6 },
  suppressLift = false,
  concealed = false,
  imageUrl,
  children,
}: CardFrameProps) {
  const spot = useCardSpotlight();
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
      // pseudo-éléments de `.media-tile` (cf. surfaces.css). L'ombre n'est plus
      // transitionnée : `box-shadow` est la seule propriété non composable de
      // tout le survol, et l'animer repeignait ~470 000 pixels dix-huit fois de
      // suite, sur une boîte qui se met à l'échelle en même temps — le
      // compositeur ne pouvait donc même pas réutiliser sa texture.
      data-hovered={hovered}
      className="media-tile relative motion-reduce:!transform-none"
      style={{
        transform: moved ? `scale(${lift.scale}) translateY(${lift.y}px)` : "scale(1)",
        opacity: concealed ? 0 : 1,
      }}
    >
      {/* Halo de ciblage — l'affiche elle-même, floutée, derrière la carte : il
          n'en dépasse que le pourtour. Il éclot au survol puis dérive, cf.
          `.card-bloom` dans surfaces.css.

          Monté EN PERMANENCE, éteint par `data-on`. Le monter au survol
          paraissait plus économe, mais chaque entrée et chaque sortie de
          curseur allouait puis libérait une surface filtrée avec son
          `will-change` — cinq à sept fois par seconde en balayant une rangée.
          L'allocation de backing store est l'une des opérations les plus
          chères du pipeline, et elle n'apparaît dans aucun profil JS. Le coût
          au repos, lui, est divisé par quatre depuis que le flou est calculé
          en sous-échelle. */}
      {imageUrl && <CardBloom on={hovered} imageUrl={imageUrl} />}

      <div
        ref={spot.ref}
        data-lit={spot.lit}
        {...spot.handlers}
        className={`card-spotlight relative ${aspect} overflow-hidden rounded-[var(--radius-lg)]`}
      >
        {/* Halo de curseur. Élément réel et non pseudo : on lui écrit son
            `transform` directement, et comme il n'a aucun descendant,
            l'invalidation de style ne se propage nulle part (cf.
            useCardSpotlight). Premier enfant, `z-index: 1` : au-dessus de
            l'affiche, sous le grain — l'empilement d'origine. */}
        <div ref={spot.glowRef} aria-hidden className="card-glow" />
        {children}
        {/* Grain de pourtour, révélé au survol — la « texture » du relief. En
            dernier enfant, au-dessus de l'image ; masqué en anneau, il ne
            couvre que le bord. */}
        <div aria-hidden data-on={hovered} className="card-grain" />
      </div>
    </div>
  );
}
