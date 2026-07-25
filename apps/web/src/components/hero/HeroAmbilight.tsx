import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { resolveBackdropId } from "./resolveBackdrop";
import { HERO_ZOOM_DURATION_S } from "./HeroBackdrop";

interface HeroAmbilightProps {
  /** Item dont l'affiche éclaire le cadre. `undefined` = pas de halo. */
  item: MediaItem | undefined;
  /**
   * Intensité, en valeur CSS. La fiche média la baisse : son halo se répand
   * DERRIÈRE le bloc titre, qui est en texte blanc — au réglage de l'accueil,
   * où la lumière ne tombe que sur du fond de page, il mangeait le contraste.
   */
  opacity?: string;
  /**
   * Boîte du halo. Par défaut celle du cadre (`absolute inset-0`) ; les
   * bannières à FOND PERDU la débordent vers le bas, seul côté par lequel leur
   * lumière peut sortir.
   */
  className?: string;
}

/**
 * Largeur de la source du halo. Volontairement DÉRISOIRE : agrandie une
 * quinzaine de fois par la mise en page, l'image n'est déjà plus qu'un champ de
 * couleurs — l'interpolation du navigateur fait l'essentiel du travail, et le
 * flou CSS n'a plus qu'à finir le lissage. C'est ce qui permet un rayon modeste
 * là où une source pleine résolution en aurait demandé trois fois plus, pour un
 * résultat identique à l'œil : le coût d'un flou croît avec son rayon.
 *
 * Effet de bord appréciable : ~4 Ko au lieu de ~300 Ko par diapositive.
 */
const SOURCE_WIDTH = 128;
/** Le halo suit la rotation de la bannière — mêmes durées, donc mêmes gestes. */
const FADE_DURATION_S = 1.4;
/**
 * Zoom un cran plus ample que celui du backdrop (1.06) : le halo respire un peu
 * plus que l'image, ce qui rend le débordement vivant plutôt que figé. Les
 * couleurs qui atteignent le bord du cadre changent donc au fil du zoom.
 */
const TARGET_SCALE = 1.12;
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
 * Aucune perte : la source fait déjà 128 px de large (cf. SOURCE_WIDTH) et le
 * flou détruit précisément le détail qu'une sous-échelle pourrait coûter.
 *
 * Le facteur est passé de quatre à huit. Au-delà de ~1024 px de large, la boîte
 * de rendu reste plus large que la source — la sous-échelle ne coûte alors
 * rigoureusement rien. En deçà (mobile, tablette) la source est bien réduite,
 * mais elle est ensuite floutée à six pixels puis agrandie huit fois : ce qui
 * atteint l'écran est un champ de couleurs de quarante-huit pixels de rayon,
 * indiscernable du précédent. C'est la nature de l'effet qui l'autorise — un
 * halo n'a, par construction, aucun détail à perdre.
 */
const RENDER_DOWNSCALE = 8;

/**
 * Halo de couleurs débordant du cadre de la bannière — « ambilight ».
 *
 * Le halo N'EST PAS une couleur calculée : c'est l'affiche elle-même, réduite,
 * floutée et posée derrière la carte. Ses couleurs suivent donc par construction
 * l'image courante ET son zoom, sans échantillonnage, sans canvas — donc sans
 * les écueils de la mesure de couleur : une image servie par Jellyfin est
 * cross-origin et « salit » un canvas, ce qui interdit d'en relire les pixels
 * sans en-têtes CORS ; et rien de tout cela ne fonctionnerait hors ligne.
 *
 * Le zoom est un cran plus ample que celui du backdrop : le halo respire un peu
 * plus que l'image, ce qui rend le débordement vivant plutôt que figé.
 *
 * Neutralisé sous `prefers-reduced-motion` : c'est un ornement animé en
 * permanence, exactement ce que ce réglage demande de taire.
 */
export function HeroAmbilight({
  item,
  opacity = "var(--hero-ambilight-opacity)",
  className = "absolute inset-0",
}: HeroAmbilightProps) {
  const reduced = useReducedMotion();
  const client = useJellyfinClient();

  const backdropId = item ? resolveBackdropId(item) : null;
  if (reduced || !item || !backdropId) return null;

  const url = client.getImageUrl(backdropId, "Backdrop", { width: SOURCE_WIDTH, quality: 70 });

  return (
    // PAS d'`overflow-hidden` sur ce conteneur : le débordement du flou EST
    // l'effet recherché. Il couvre exactement la carte, la lumière s'échappe
    // tout autour, sur le fond de page.
    // L'intensité du halo vit sur ce CONTENEUR, jamais sur l'image : celle-ci
    // anime déjà son opacité pour le fondu enchaîné d'une diapositive à
    // l'autre, et les deux valeurs se seraient écrasées l'une l'autre.
    <div
      aria-hidden
      className={`pointer-events-none ${className}`}
      style={{ opacity }}
    >
      {/* Boîte de rendu SOUS-ÉCHELLE, agrandie par le compositeur.
          Le flou est calculé sur 1/16 de la surface, puis la texture floutée
          est agrandie — cf. RENDER_DOWNSCALE. `top/left: 0` + origine au coin
          supérieur gauche : une boîte de 1/n agrandie n fois recouvre
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
            key={item.Id}
            src={url}
            alt=""
            draggable={false}
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: 1, scale: TARGET_SCALE }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: FADE_DURATION_S, ease: "easeOut" },
              scale: { duration: HERO_ZOOM_DURATION_S, ease: "linear" },
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
