import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { markImageSeen } from "../../lib/seenImages";
import { ENTRY_FADE, useBillboardEntry } from "./useBillboardEntry";

/** Le halo suit la rotation de la bannière — mêmes durées, donc mêmes gestes. */
const FADE_DURATION_S = 1.4;
/**
 * Le zoom du halo — 1 → 1,12, un cran plus ample que celui du fond (1,06) — est
 * la classe `hero-halo-zoom` (`theme/heroMotion.css`), jouée par le compositeur
 * au même rythme que le fond : leurs paliers tombent ensemble. Le halo respire
 * un peu plus que l'image, ce qui rend le débordement vivant plutôt que figé ;
 * aucun palier ne peut s'y voir, le flou les efface par construction.
 */
const ZOOM_CLASS = "hero-halo-zoom";
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
  // Le halo arrive avec sa bannière, jamais une seconde après elle (`useBillboardEntry`).
  const entry = useBillboardEntry(url ? layerKey : null, url);
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
          exactement la boîte d'origine. Le zoom de l'image se compose avec
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
        <AnimatePresence initial={entry.presenceInitial}>
          {/* La COUCHE de la diapositive : elle porte le zoom (compositeur) et
              le fondu enchaîné, et rien d'autre. Le flou est sur l'image
              DEDANS, qui n'a pas de couche à elle : il est rastérisé une fois
              dans la texture de cette couche, que le zoom ne fait qu'agrandir.
              Posé sur la couche animée elle-même, il devenait un filtre de
              compositeur, réappliqué à CHAQUE palier du zoom, à l'échelle de
              l'écran — la sous-échelle n'y changeait rien (mesuré sur la TV LG,
              dont le halo n'a pas de couche pour la même raison). */}
          <motion.div
            key={layerKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { opacity: { duration: FADE_DURATION_S, ease: "easeOut" } } }}
            transition={{ opacity: entry.isEntry ? ENTRY_FADE : { duration: FADE_DURATION_S, ease: "easeOut" } }}
            className={`absolute inset-0 will-change-transform ${ZOOM_CLASS}`}
          >
            <img
              src={url}
              alt=""
              draggable={false}
              onLoad={() => markImageSeen(url)}
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                // Rayon divisé par la sous-échelle : agrandi d'autant ensuite, il
                // redonne exactement le flou d'origine.
                // `brightness` : 1 par défaut ; la lueur de la fiche le baisse
                // (`.hero-glow`), où des textes se posent sur elle.
                filter:
                  `blur(calc(var(--hero-ambilight-blur) / ${RENDER_DOWNSCALE}))` +
                  " saturate(var(--hero-ambilight-sat)) brightness(var(--hero-ambilight-brightness, 1))",
              }}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
