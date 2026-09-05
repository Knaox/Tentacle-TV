import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { HERO_ZOOM_DURATION_S } from "./HeroBackdrop";
import { AMBIENT_HZ, cadence } from "../../theme/motion";

/** Le halo suit la rotation de la bannière — mêmes durées, donc mêmes gestes. */
const FADE_DURATION_S = 1.4;
/**
 * Zoom un cran plus ample que celui du backdrop (1.06) : le halo respire un peu
 * plus que l'image, ce qui rend le débordement vivant plutôt que figé. Les
 * couleurs qui atteignent le bord du cadre changent donc au fil du zoom.
 */
const TARGET_SCALE = 1.12;
/**
 * Même bridage que le backdrop, et le halo s'y prête encore mieux : ce qu'il
 * affiche est une tache de couleurs floutée à quarante-huit pixels. Aucun pas de
 * quantification ne peut s'y voir — le flou les efface par construction, bien
 * avant que l'œil n'ait à trancher.
 */
const ZOOM_EASE = cadence(AMBIENT_HZ, HERO_ZOOM_DURATION_S);
/**
 * Facteur de sous-échelle du rendu — le vrai levier de coût de ce composant.
 *
 * Un flou gaussien se paie par pixel ET par rayon. Le calculer à pleine
 * résolution sur une bannière de 76 vh était un gaspillage franc : sur un écran
 * Retina, cela représente plusieurs millions de pixels, retraités à chaque image
 * de l'animation.
 *
 * On rend donc le halo dans une boîte réduite d'autant, avec un rayon divisé
 * d'autant, puis on agrandit par `transform`. Le compositeur agrandit une
 * texture DÉJÀ floutée, ce qui est quasi gratuit — la surface effectivement
 * floutée est divisée par le CARRÉ du facteur, soit soixante-quatre fois ici.
 *
 * Aucune perte : la source fait ~128 px de large et le flou détruit précisément
 * le détail qu'une sous-échelle pourrait coûter.
 */
const RENDER_DOWNSCALE = 8;

interface AmbilightLayerProps {
  /** URL d'une source DÉRISOIRE (~128 px) — null = pas de halo. */
  url: string | null;
  /** Clé de diapositive : pilote le fondu enchaîné d'AnimatePresence. */
  layerKey: string;
  /** Intensité, en valeur CSS (la fiche média la baisse — cf. HeroAmbilight). */
  opacity?: string;
  /** Boîte du halo. Par défaut celle du cadre (`absolute inset-0`). */
  className?: string;
}

/**
 * Cœur présentationnel du halo « ambilight », partagé entre l'accueil et le
 * carrousel des recommandations. Le halo N'EST PAS une couleur calculée :
 * c'est l'image elle-même, réduite, floutée et posée derrière la carte. Ses
 * couleurs suivent par construction l'image courante ET son zoom, sans
 * échantillonnage, sans canvas — donc sans les écueils de la mesure de
 * couleur (une image Jellyfin est cross-origin et « salirait » un canvas).
 *
 * Neutralisé sous `prefers-reduced-motion` : c'est un ornement animé en
 * permanence, exactement ce que ce réglage demande de taire.
 */
export function AmbilightLayer({
  url,
  layerKey,
  opacity = "var(--hero-ambilight-opacity)",
  className = "absolute inset-0",
}: AmbilightLayerProps) {
  const reduced = useReducedMotion();
  if (reduced || !url) return null;

  return (
    // PAS d'`overflow-hidden` sur ce conteneur : le débordement du flou EST
    // l'effet recherché. Il couvre exactement la carte, la lumière s'échappe
    // tout autour, sur le fond de page.
    // L'intensité du halo vit sur ce CONTENEUR, jamais sur l'image : celle-ci
    // anime déjà son opacité pour le fondu enchaîné d'une diapositive à
    // l'autre, et les deux valeurs se seraient écrasées l'une l'autre.
    <div aria-hidden className={`pointer-events-none ${className}`} style={{ opacity }}>
      {/* Boîte de rendu SOUS-ÉCHELLE, agrandie par le compositeur.
          Le flou est calculé sur une fraction de la surface, puis la texture
          floutée est agrandie — cf. RENDER_DOWNSCALE. `top/left: 0` + origine
          au coin supérieur gauche : une boîte de 1/n agrandie n fois recouvre
          exactement la boîte d'origine. Le zoom de Framer se compose avec
          cette échelle au lieu de la remplacer. */}
      <div
        className="absolute left-0 top-0"
        style={{
          width: `${100 / RENDER_DOWNSCALE}%`,
          height: `${100 / RENDER_DOWNSCALE}%`,
          transform: `scale(${RENDER_DOWNSCALE})`,
          transformOrigin: "top left",
        }}
      >
        <AnimatePresence>
          <motion.img
            key={layerKey}
            src={url}
            alt=""
            draggable={false}
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: 1, scale: TARGET_SCALE }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: FADE_DURATION_S, ease: "easeOut" },
              scale: { duration: HERO_ZOOM_DURATION_S, ease: ZOOM_EASE },
            }}
            // `will-change: transform` : le flou est alors rastérisé UNE fois dans
            // sa propre couche, et le zoom devient une simple transformation de
            // compositeur. Sans lui, un flou de cette taille serait recalculé à
            // chaque image de l'animation.
            className="absolute inset-0 h-full w-full object-cover will-change-transform"
            style={{
              // Rayon divisé par la sous-échelle : agrandi d'autant ensuite, il
              // redonne exactement le flou d'origine.
              filter:
                `blur(calc(var(--hero-ambilight-blur) / ${RENDER_DOWNSCALE}))` +
                " saturate(var(--hero-ambilight-sat))",
            }}
          />
        </AnimatePresence>
      </div>
    </div>
  );
}
