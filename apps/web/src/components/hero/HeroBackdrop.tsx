import { AnimatePresence, cubicBezier, motion } from "framer-motion";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { heroBackdropUrl } from "./resolveBackdrop";
import { AMBIENT_HZ, cadence } from "../../theme/motion";
import { useImageCassee } from "../../hooks/useImageCassee";
import { HeroScrims } from "./HeroScrims";

interface HeroBackdropProps {
  items: MediaItem[];
  activeIndex: number;
}

/**
 * Hero backdrop synchronisé avec la rotation du carrousel :
 *  • Zoom doux scale(1) → scale(1.10) sur ~10s avec ease-out (cubic-bezier
 *    0.16,1,0.3,1) — la sensation "plus ça zoom plus c'est lent" vient de
 *    cette courbe : la vitesse perçue décroît continûment jusqu'à l'arrêt.
 *  • À la fin du zoom, HeroBillboard déclenche le slide suivant ; l'image
 *    sortante fade-out pendant que la nouvelle fade-in + recommence son
 *    propre zoom depuis scale(1). L'enchaînement infini donne l'impression
 *    d'un zoom continu sans coupure mécanique.
 *
 * Seul l'item actif est rendu (+ l'item sortant brièvement durant le fade),
 * via AnimatePresence — plus de stack de N <img> avec opacity à zéro.
 */
export const HERO_ZOOM_DURATION_S = 8;
const FADE_DURATION_S = 1.2;
// Scale 1 → 1.06 perçu comme un travelling lent et CONSTANT sur 9.5s. On
// utilise `linear` exprès : un ease-out tassait 80% du mouvement sur les 3
// premières secondes, donnant l'illusion d'un zoom court — le reste de la
// durée l'image paraissait figée. Linear étale uniformément la motion.
const TARGET_SCALE = 1.06;
/**
 * Le zoom ne met son échelle à jour que trente fois par seconde, au lieu d'une
 * fois par image d'affichage.
 *
 * Six pour cent étalés sur huit secondes, c'est un dixième de pixel de
 * progression entre deux images à 120 Hz — et une recomposition d'image plein
 * écran à chaque fois. À trente, la progression passe à quatre dixièmes de
 * pixel : toujours sous le pixel, donc toujours lisse, pour deux à huit fois
 * moins de recompositions selon la fréquence de l'écran (cf. `cadence`).
 *
 * `linear` reste `linear` : la quantification porte sur le TEMPS, la trajectoire
 * et la durée sont inchangées.
 */
const ZOOM_EASE = cadence(AMBIENT_HZ, HERO_ZOOM_DURATION_S);
/**
 * Le fondu enchaîné d'une diapositive à l'autre est bridé lui aussi.
 *
 * Il l'avait d'abord été épargné — c'est un mouvement qu'on REGARDE, et deux
 * images plein cadre s'y superposent. Mais trente-six paliers d'opacité sur
 * 1,2 s restent au-dessus de la cadence du cinéma, et c'est précisément le
 * moment le plus cher de toute l'application : pendant ces 1,2 s, DEUX images
 * plein écran coexistent, chacune avec son propre halo flouté, toutes composées
 * à chaque image d'affichage. Diviser cette cadence par deux à quatre selon
 * l'écran porte donc sur le pic, pas sur le régime de croisière.
 *
 * La courbe est passée EXPLICITEMENT : `cadence` quantifie le temps puis
 * applique l'easing reçu, donc sans elle le fondu deviendrait linéaire — ce qui
 * se verrait. `cubicBezier(0, 0, 0.58, 1)` est la définition exacte du mot-clé
 * `easeOut` qu'utilisait cette transition.
 */
const FADE_EASE = cadence(AMBIENT_HZ, FADE_DURATION_S, cubicBezier(0, 0, 0.58, 1));

export function HeroBackdrop({ items, activeIndex }: HeroBackdropProps) {
  const client = useJellyfinClient();
  const item = items[activeIndex];

  // URL résolue par `resolveBackdrop`, partagée avec la transition d'ouverture
  // de fiche : celle-ci reprend donc un pixel DÉJÀ décodé, sans un octet de
  // plus. Une URL recalculée d'un côté ou de l'autre (largeur ou qualité
  // différente) suffirait à provoquer un second chargement, donc un blanc.
  //
  // Calculée AVANT le retour anticipé : le suivi de l'échec est un hook, il ne
  // peut pas vivre après une sortie conditionnelle.
  const url = item ? heroBackdropUrl(client, item) : null;
  const { cassee, signalerEchec } = useImageCassee(url ?? undefined);

  // Solid base + gradients restent rendus en permanence (jamais animés).
  //
  // La pile elle-même vit dans `HeroScrims`, partagée avec la bibliothèque et
  // la fiche média. Les trois pages posaient la même grammaire, recopiée trois
  // fois, et les trois copies avaient dérivé — chaque écart se payant ensuite
  // sur un téléviseur, où la même image ne rendait pas pareil selon la page
  // qui la portait. Les chaînes COMPLÈTES des jetons restent dans
  // `theme/scrims.css` et `theme/surfaces.css`.
  //
  // `h-[62%]` et non 55 % : la rampe de `--hero-scrim-bottom` a été adoucie
  // (quatre paliers) et a besoin de plus de course pour atteindre l'opacité
  // sans marche visible.
  //
  // PAS de raccord vers la page (`--hero-page-fade`). Il existait pour fondre
  // une bannière à FOND PERDU dans la page : la première rangée la chevauchait,
  // il fallait effacer la couture. La bannière est désormais encadrée — son
  // bord bas est un vrai bord, net, et plus rien ne la chevauche.
  const overlays = <HeroScrims bas="h-[62%]" />;

  if (!item) {
    return (
      <>
        <div className="absolute inset-0 bg-surface-0" />
        {overlays}
      </>
    );
  }

  return (
    <>
      <div className="absolute inset-0 bg-surface-0" />

      <AnimatePresence>
        {url && (
          <motion.img
            key={item.Id}
            src={url}
            alt=""
            draggable={false}
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: 1, scale: TARGET_SCALE }}
            exit={{ opacity: 0 }}
            transition={{
              // `easeOut` est PRÉSERVÉE : `cadence` quantifie le temps avant
              // d'appliquer la courbe, jamais la valeur après. Le fondu garde
              // donc exactement sa trajectoire et sa durée.
              opacity: { duration: FADE_DURATION_S, ease: FADE_EASE },
              scale: { duration: HERO_ZOOM_DURATION_S, ease: ZOOM_EASE },
            }}
            className="absolute inset-0 h-full w-full object-cover will-change-transform motion-reduce:!transform-none"
            style={{ display: cassee ? "none" : undefined }}
            onError={signalerEchec}
          />
        )}
      </AnimatePresence>

      {overlays}
    </>
  );
}
