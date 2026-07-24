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
            filter: "blur(var(--hero-ambilight-blur)) saturate(var(--hero-ambilight-sat))",
          }}
        />
      </AnimatePresence>
    </div>
  );
}
