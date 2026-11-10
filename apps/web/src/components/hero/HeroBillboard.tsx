import { useEffect, useMemo, useState } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { AmbilightLayer } from "./AmbilightLayer";
import { HeroBackdrop, HERO_ZOOM_DURATION_S } from "./HeroBackdrop";
import { HeroContent } from "./HeroContent";
import { HeroIndicators } from "./HeroIndicators";
import { useBillboardRotation } from "./useBillboardRotation";
import { billboardActivity } from "./billboardActivity";
import { useHeroImageFailures } from "./useHeroImageFailures";
import { useHeroImage } from "./useHeroImage";
import { useDataSaverActive } from "../../offline/useDataSaver";
import { useBillboardViewport } from "./useBillboardViewport";
import { useIdle } from "../../hooks/useIdle";
import { useTranslation } from "react-i18next";
import { useBillboardGestures } from "./useBillboardGestures";

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

const NO_IDS: ReadonlySet<string> = new Set();

/**
 * La boîte du halo : la carte, un peu plus large qu'elle et bien plus basse — sa lumière sort
 * surtout par le bas, sur le haut des rangées (le prototype validé). Elle ne monte pas sous la
 * barre du haut, dont le verre la refloute déjà.
 */
const HALO_BOX = "absolute -inset-x-[3%] top-2 -bottom-[18%]";

// Synchronisé avec le zoom du backdrop : on change de slide pile à la fin
// du cycle scale 1 → 1.10 pour un enchaînement perçu comme continu.
const DEFAULT_ROTATE_MS = HERO_ZOOM_DURATION_S * 1000;

/**
 * Cinematic full-bleed billboard — the centerpiece of the home page.
 * Targets ~92vh so the topnav floats transparent over its top edge and the
 * fade-to-black bottom flows seamlessly into the first row below.
 */
export function HeroBillboard({ items: chosen, rotateMs = DEFAULT_ROTATE_MS }: HeroBillboardProps) {
  // Une image en échec (404) passe la main à la suivante du plan du titre
  // (`useHeroImage` : l'annoncé, le fond TMDB, toute image Jellyfin, l'affiche) ;
  // un titre qui n'a plus RIEN quitte la rotation. Si aucun n'a d'image, la
  // bannière garde ses titres sur le fond de marque : jamais du noir.
  const { failed, reportFailure } = useHeroImageFailures();
  const [exhausted, setExhausted] = useState<ReadonlySet<string>>(NO_IDS);
  const items = useMemo(() => {
    const shown = chosen.filter((item) => !exhausted.has(item.Id));
    return shown.length > 0 ? shown : chosen;
  }, [chosen, exhausted]);
  const dataSaver = useDataSaverActive();
  // Deux seuils sur le même cadre (fenêtre au premier plan dans les deux cas,
  // cf. `billboardActivity`) : à 200 px, le halo est remonté AVANT d'entrer
  // dans le champ ; strictement à l'écran, la rotation tourne.
  const { ref: frameRef, near, onScreen } = useBillboardViewport<HTMLDivElement>();
  // Personne devant l'écran depuis vingt secondes : on cesse de relancer.
  const idle = useIdle(IDLE_MS);
  // La minuterie est suspendue (index conservé, reprise invisible) dans trois
  // cas, chacun payé par une mesure :
  // — Mode économie : chaque rotation charge un backdrop 1920 px sans lazy ni
  //   préchargement (~250-400 Ko), rien n'est mis en cache — 5 min sur
  //   l'accueil coûtaient jusqu'à ~10 Mo en pure perte. La navigation manuelle
  //   (flèches, indicateurs) reste disponible.
  // — Hors écran (STRICTEMENT : la marge de 200 px ne vaut que pour le halo)
  //   ou fenêtre en arrière-plan : chaque rotation recrée un fond 1920 px ET
  //   un halo flouté plein cadre, les deux coexistant pendant le fondu — pour
  //   une bannière que personne ne regarde.
  // — Inactivité : le seul geste qui fasse vraiment redescendre le GPU ici.
  //   Brider la cadence d'une animation n'endort pas le compositeur : tant
  //   qu'une animation est en cours, le navigateur produit une image à chaque
  //   rafraîchissement. Or le carrousel relançait une animation toutes les
  //   huit secondes, sans fin — le GPU ne se rendormait jamais. Rien n'est
  //   figé brutalement : le zoom en cours va au bout, puis plus rien ne
  //   repart. Le moindre geste (souris, défilement, clavier, toucher) remet
  //   en marche SUR-LE-CHAMP : la diapositive suivante arrive avec son fondu,
  //   son zoom, son halo et son indicateur — pas une image figée pendant
  //   encore un cycle (cf. useBillboardRotation).
  const activity = billboardActivity({ near, onScreen, idle, dataSaver });
  const { index, animKey, selectWithGrace, prevWithGrace, nextWithGrace } =
    useBillboardRotation({
      count: items.length,
      rotateMs,
      active: activity.rotating,
    });

  // Flèches, pastilles — et le clavier (← →), la molette horizontale, le glissé au doigt.
  const gestures = useBillboardGestures({ onPrev: prevWithGrace, onNext: nextWithGrace });
  const { t } = useTranslation("common");
  const labels = useMemo(() => items.map((item) => (item.Type === "Episode" ? (item.SeriesName ?? item.Name) : item.Name)), [items]);

  const active: MediaItem | undefined = items[Math.min(index, items.length - 1)];
  const image = useHeroImage(active, failed);
  const activeId = active?.Id;
  useEffect(() => {
    if (image.exhausted && activeId) setExhausted((prev) => (prev.has(activeId) ? prev : new Set(prev).add(activeId)));
  }, [image.exhausted, activeId]);

  // Rien à montrer : la bannière se RETIRE. Un cadre vide de 76 vh restait
  // noir, sans titre ni bouton (titre fixe effacé de Jellyfin).
  if (!active) return null;
  const imageKey = image.key;

  // NB : le survol ne suspend PAS la rotation — la bannière couvre ~76 vh, le curseur la
  // survole quasi en permanence, ce qui figeait le carrousel à la première diapositive.
  return (
    // Le CADRE : fond de page, gouttières de rangée. Aucun `overflow-hidden`
    // ici — le halo doit pouvoir déborder de la carte sur le fond, c'est tout
    // l'effet. `bg-surface-0` et non un noir littéral : en thème clair le cadre
    // doit être nacré comme la page, pas une bande sombre autour d'elle.
    <section className={`relative w-full bg-surface-0 pb-6 md:pb-10 ${FRAME_GUTTER}`} aria-label={t("common:featuredCarousel")}>
      <div ref={frameRef} className="relative">
        {/* Halo, DERRIÈRE la carte : l'image elle-même, réduite et floutée — ses couleurs
            changent donc avec elle, en fondu enchaîné. Il déborde un peu sur les côtés et
            largement vers le bas, où sa lumière baigne le haut des rangées.

            Démonté hors écran : c'est une image floutée sur toute la largeur, animée en
            boucle. Suspendre la rotation ne suffit pas, le zoom continuerait de la faire
            re-rastériser. */}
        {activity.haloMounted && <AmbilightLayer url={image.haloUrl} layerKey={active.Id} className={HALO_BOX} />}

        {/* La carte. Repère de la transition d'ouverture : c'est ce cadre que
            « Plus d'infos » fait s'ouvrir jusqu'au plein écran de la fiche.
            Focalisable : ← et → y font défiler les titres (`useBillboardGestures`). */}
        <div
          data-hero-frame
          role="group"
          aria-roledescription="carousel"
          aria-label={t("common:featuredCarousel")}
          tabIndex={0}
          className={`group/billboard relative w-full overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 ${CARD_HEIGHT}`}
          style={{
            borderRadius: "var(--hero-frame-radius)",
            boxShadow: "var(--hero-frame-ring)",
            touchAction: "pan-y",
          }}
          {...gestures}
        >
          <HeroBackdrop item={active} url={image.url} onFailure={imageKey ? () => reportFailure(imageKey) : undefined} />
          <HeroContent item={active} animationKey={animKey} imageUrl={image.url} />
          <HeroIndicators
            count={items.length}
            activeIndex={index}
            durationMs={rotateMs}
            labels={labels}
            onSelect={selectWithGrace}
            onPrev={prevWithGrace}
            onNext={nextWithGrace}
          />
          {/* L'arête de la carte : un trait de lumière en haut, un filet tout autour — PAR-DESSUS
              l'image (une ombre intérieure du cadre serait peinte dessous, invisible). */}
          <div aria-hidden className="pointer-events-none absolute inset-0 z-[11] rounded-[inherit] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1),inset_0_1px_0_rgba(255,255,255,0.16)]" />
        </div>
      </div>
    </section>
  );
}
