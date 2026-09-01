import type { MediaItem } from "@tentacle-tv/shared";
import { HeroAmbilight } from "./HeroAmbilight";
import { HeroBackdrop, HERO_ZOOM_DURATION_S } from "./HeroBackdrop";
import { HeroContent } from "./HeroContent";
import { HeroIndicators } from "./HeroIndicators";
import { useBillboardRotation } from "./useBillboardRotation";
import { useDataSaverActive } from "../../offline/useDataSaver";
import { useInViewport } from "../../hooks/useInViewport";
import { useHoverMount } from "../../hooks/useHoverMount";
import { useIdle } from "../../hooks/useIdle";

/**
 * Silence au bout duquel le carrousel cesse de se relancer.
 *
 * Vingt secondes sans le moindre geste — ni souris, ni clavier, ni défilement,
 * ni toucher. En usage normal on n'y arrive jamais : le seuil se franchit quand
 * on a quitté l'écran des yeux, pas quand on hésite devant une affiche.
 */
const IDLE_MS = 20_000;

/**
 * Hauteur de la carte. Réduite depuis le passage au cadre : à fond perdu elle
 * pouvait occuper 92 vh puisqu'elle commençait sous la barre de navigation et
 * se fondait dans la page. Encadrée, elle démarre SOUS la nav et doit laisser
 * voir son cadre en bas — sans quoi il n'y a plus de cadre, juste une bannière
 * aux coins arrondis.
 */
export const CARD_HEIGHT = "h-[62vh] md:h-[70vh] lg:h-[76vh]";
/** Gouttière du cadre = celle des rangées : le bord gauche de la bannière tombe
 *  alors exactement sur la première affiche de chaque rangée. Exportées (avec
 *  CARD_HEIGHT) : le carrousel des recommandations partage la géométrie au
 *  pixel près. */
export const FRAME_GUTTER = "px-[var(--row-gutter-mobile)] md:px-[var(--row-gutter-desktop)]";

interface HeroBillboardProps {
  items: MediaItem[];
  /** Auto-rotate interval in ms. Set to 0 to disable. Default = zoom duration. */
  rotateMs?: number;
}

// Synchronisé avec le zoom du backdrop : on change de slide pile à la fin
// du cycle scale 1 → 1.10 pour un enchaînement perçu comme continu.
const DEFAULT_ROTATE_MS = HERO_ZOOM_DURATION_S * 1000;

/**
 * Cinematic full-bleed billboard — the centerpiece of the home page.
 * Targets ~92vh so the topnav floats transparent over its top edge and the
 * fade-to-black bottom flows seamlessly into the first row below.
 */
export function HeroBillboard({ items, rotateMs = DEFAULT_ROTATE_MS }: HeroBillboardProps) {
  const dataSaver = useDataSaverActive();
  // Bannière réellement à l'écran ET fenêtre au premier plan. Tout ce qui suit
  // — rotation, zoom du fond, halo flouté — ne tourne QUE dans ce cas.
  // Marge de 200 px : le halo est remonté AVANT d'entrer réellement dans le
  // champ, pour qu'on ne surprenne jamais son fondu d'apparition en remontant.
  const { ref: frameRef, visible } = useInViewport<HTMLDivElement>("200px");
  // Personne devant l'écran depuis vingt secondes : on cesse de relancer.
  const idle = useIdle(IDLE_MS);
  // Survol de la carte — il ne sert QU'À monter les flèches, jamais à
  // suspendre la rotation (cf. la note plus bas : la bannière couvre ~76 vh,
  // le curseur la survole quasi en permanence, mettre le timer en pause ici
  // figeait le carrousel sur sa première diapositive). Les flèches portent un
  // `backdrop-filter` posé sur une image qui zoome sans fin : les laisser
  // montées à `opacity: 0` faisait recalculer leur flou à chaque image.
  // `duration-300` était le tempo de la classe Tailwind remplacée.
  const arrows = useHoverMount(300);

  // La minuterie est suspendue (index conservé, reprise invisible) dans trois
  // cas, chacun payé par une mesure :
  // — Mode économie : chaque rotation charge un backdrop 1920 px sans lazy ni
  //   préchargement (~250-400 Ko), rien n'est mis en cache — 5 min sur
  //   l'accueil coûtaient jusqu'à ~10 Mo en pure perte. La navigation manuelle
  //   (flèches, indicateurs) reste disponible.
  // — Hors écran ou fenêtre en arrière-plan : chaque rotation recrée un fond
  //   1920 px ET un halo flouté plein cadre, les deux coexistant pendant le
  //   fondu — pour une bannière que personne ne regarde.
  // — Inactivité : le seul geste qui fasse vraiment redescendre le GPU ici.
  //   Brider la cadence d'une animation n'endort pas le compositeur : tant
  //   qu'une animation est en cours, le navigateur produit une image à chaque
  //   rafraîchissement. Or le carrousel relançait une animation toutes les
  //   huit secondes, sans fin — le GPU ne se rendormait jamais. Rien n'est
  //   figé brutalement : le zoom en cours va au bout, puis plus rien ne
  //   repart ; le moindre geste remet en marche.
  const { index, animKey, selectWithGrace, prevWithGrace, nextWithGrace } =
    useBillboardRotation({
      count: items.length,
      rotateMs,
      active: !dataSaver && visible && !idle,
    });

  if (!items.length) {
    return <div className={`w-full ${CARD_HEIGHT}`} />;
  }

  // NB: pas de onMouseEnter={pause}/onMouseLeave={resume} sur la section —
  // le hero couvre ~90vh, le curseur le survole quasi en permanence, ce qui
  // figeait le carrousel à la première slide. Le timer continue de tourner ;
  // l'utilisateur peut toujours interrompre via les flèches / indicateurs
  // (qui font un pause éphémère 100ms pour absorber le clic).
  return (
    // Le CADRE : fond de page, gouttières de rangée. Aucun `overflow-hidden`
    // ici — le halo doit pouvoir déborder de la carte sur le fond, c'est tout
    // l'effet. `bg-surface-0` et non un noir littéral : en thème clair le cadre
    // doit être nacré comme la page, pas une bande sombre autour d'elle.
    <section
      className={`relative w-full bg-surface-0 pb-6 md:pb-10 ${FRAME_GUTTER}`}
      aria-label="Featured content"
    >
      <div ref={frameRef} className="relative">
        {/* Halo, DERRIÈRE la carte : il occupe exactement sa surface et sa
            lumière s'échappe tout autour.

            Démonté hors écran : c'est une image floutée à 48 px sur toute la
            largeur, animée en boucle infinie. Suspendre la rotation ne suffit
            pas, le zoom continuerait de la faire re-rastériser. */}
        {visible && <HeroAmbilight item={items[index]} />}

        {/* La carte. Repère de la transition d'ouverture : c'est ce cadre que
            « Plus d'infos » fait s'ouvrir jusqu'au plein écran de la fiche. */}
        <div
          data-hero-frame
          className={`group/billboard relative w-full overflow-hidden ${CARD_HEIGHT}`}
          style={{
            borderRadius: "var(--hero-frame-radius)",
            boxShadow: "var(--hero-frame-ring)",
          }}
          onMouseEnter={arrows.onMouseEnter}
          onMouseLeave={arrows.onMouseLeave}
        >
          <HeroBackdrop items={items} activeIndex={index} />
          <HeroContent item={items[index]} animationKey={animKey} />
          <HeroIndicators
            count={items.length}
            activeIndex={index}
            durationMs={rotateMs}
            arrowsMounted={arrows.mounted}
            arrowsShown={arrows.hovered}
            onSelect={selectWithGrace}
            onPrev={prevWithGrace}
            onNext={nextWithGrace}
          />
        </div>
      </div>
    </section>
  );
}
