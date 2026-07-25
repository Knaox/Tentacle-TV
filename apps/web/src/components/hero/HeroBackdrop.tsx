import { AnimatePresence, motion } from "framer-motion";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { heroBackdropUrl } from "./resolveBackdrop";
import { AMBIENT_HZ, cadence } from "../../theme/motion";

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

export function HeroBackdrop({ items, activeIndex }: HeroBackdropProps) {
  const client = useJellyfinClient();
  const item = items[activeIndex];

  // Solid base + gradients restent rendus en permanence (jamais animés).
  const overlays = (
    <>
      {/* Pile de degrades cinema. Les chaines COMPLETES vivent dans
          theme/scrims.css et theme/surfaces.css : assise NOIRE constante
          (`--scrim-media-rgb`) sous le texte on-media dans les DEUX schemas —
          recette mobile, l'affiche reste vive, aucun voile clair ni flou.
          Seul le voile haut suit le theme (assise de la TopNav).

          Le scrim principal est DIAGONAL (72deg) : son coin sombre tombe en
          bas-gauche, pile sous la colonne de texte, la ou le 90deg d'origine
          assombrissait tout le flanc gauche a hauteur egale. */}
      <div className="absolute inset-0" style={{ background: "var(--hero-scrim-diagonal)" }} />
      {/* Voile de marque : c'est lui qui rend l'ombre VIOLETTE plutot que
          neutre. Alphas volontairement bas — au-dela l'affiche vire au
          monochrome. Construit sur `--brand-rgb`, donc une surcharge de theme
          depuis l'admin le suit sans une ligne de code. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--hero-brand-wash)" }}
        aria-hidden
      />
      {/* 62 % et non 55 % : la rampe de `--hero-scrim-bottom` a été adoucie
          (quatre paliers) et a besoin de plus de course pour atteindre
          l'opacité sans marche visible. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[62%]"
        style={{ background: "var(--hero-scrim-bottom)" }}
      />
      {/* PAS de raccord bas vers la page (`--hero-page-fade`, retiré). Il
          existait pour fondre une bannière à FOND PERDU dans la page : la
          première rangée la chevauchait, il fallait effacer la couture. La
          bannière est désormais encadrée — son bord bas est un vrai bord, net,
          et plus rien ne la chevauche. Le fondu n'y assombrissait plus que le
          bas de la carte, sans rien raccorder. */}
      {/* Vignette haute sous la TopNav — la nav est en texte theme, son assise
          suit le schema. */}
      <div
        className="absolute inset-x-0 top-0 h-40"
        style={{ background: "var(--hero-scrim-top)" }}
      />
      {/* Tiny grain to avoid banding on solid color zones — pas de mix-blend-mode
       * pour éviter le rectangle blanc fantôme dans Tauri WKWebView. */}
      <div className="noise-texture absolute inset-0 opacity-[0.06]" aria-hidden />
      {/* PAS de ligne de lumière en couture basse. L'idée supposait une couture
          VISIBLE ; or les rangées remontent de 48-64 px (`-mt-12/-mt-16` dans
          Home.tsx) et sont transparentes : la hairline se retrouvait tracée en
          travers de la première rangée d'affiches, à 63 px sous son titre. Même
          cause que sur la fiche média et l'en-tête de bibliothèque — le geste
          ne tient sur aucune des trois surfaces, il est abandonné partout. */}
    </>
  );

  if (!item) {
    return (
      <>
        <div className="absolute inset-0 bg-surface-0" />
        {overlays}
      </>
    );
  }

  // URL résolue par `resolveBackdrop`, partagée avec la transition d'ouverture
  // de fiche : celle-ci reprend donc un pixel DÉJÀ décodé, sans un octet de
  // plus. Une URL recalculée d'un côté ou de l'autre (largeur ou qualité
  // différente) suffirait à provoquer un second chargement, donc un blanc.
  const url = heroBackdropUrl(client, item);

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
              // Le fondu garde sa pleine cadence : 1,2 s d'opacité sur une
              // image plein cadre, c'est un mouvement qu'on regarde.
              opacity: { duration: FADE_DURATION_S, ease: "easeOut" },
              scale: { duration: HERO_ZOOM_DURATION_S, ease: ZOOM_EASE },
            }}
            className="absolute inset-0 h-full w-full object-cover will-change-transform motion-reduce:!transform-none"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
      </AnimatePresence>

      {overlays}
    </>
  );
}
