import { motion, useReducedMotion } from "framer-motion";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { HeroAmbilight } from "../hero/HeroAmbilight";
import { firstBackdropItem, heroBackdropUrl, resolveBackdropId } from "../hero/resolveBackdrop";
import { fadeUp, textCascade } from "../../theme/motion";
import { useInViewport } from "../../hooks/useInViewport";
import { useBrokenImage } from "../../hooks/useBrokenImage";
import { HeroScrims } from "../hero/HeroScrims";

interface CollectionHeroProps {
  title: string;
  /** Sur-titre : « Ma liste », « Mes favoris » — déjà traduit. */
  kicker: string;
  /** La collection, telle qu'elle est chargée. Le sujet en sort. */
  items: MediaItem[] | undefined;
  /** Compte affiché sous le titre, déjà formaté et traduit. */
  subtitle?: string;
}

/**
 * La bannière de Ma liste et de Mes favoris — la grammaire de `LibraryHero`,
 * au mot près : boîte de mise en page, boîte image qui déborde de 200 px, la
 * même pile de voiles, la même lueur de raccord.
 *
 * Une seule différence, et c'est la bonne : ZÉRO requête. La bibliothèque tire
 * un fond au hasard parmi ses titres ; ici le sujet est le premier de la
 * collection, déjà en mémoire. Une liste qu'on a soi-même constituée n'a pas
 * besoin qu'on lui cherche une vitrine.
 *
 * Sur une liste vide, rien n'est rendu : une bannière noire sous un écran qui
 * dit « ajoutez des titres » n'annonce rien.
 */
export function CollectionHero({ title, kicker, items, subtitle }: CollectionHeroProps) {
  const client = useJellyfinClient();
  const reduced = useReducedMotion();
  const { ref: boxRef, visible } = useInViewport<HTMLDivElement>("200px");

  const featured = firstBackdropItem(items);
  const backdropId = featured ? resolveBackdropId(featured) : null;
  const { broken, reportFailure } = useBrokenImage(backdropId ?? undefined);
  const url = heroBackdropUrl(client, featured ?? undefined);

  if (!items || items.length === 0) return null;

  return (
    <section className="relative w-full" aria-label={title}>
      <div ref={boxRef} className="absolute inset-x-0 top-0 -bottom-[200px] overflow-hidden">
        <div className="absolute inset-0 bg-surface-0" />

        {url && (
          <motion.img
            key={backdropId}
            src={url}
            alt=""
            draggable={false}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            /* `will-change-transform` comme les trois autres bannières : la
               promotion en couche décide de la façon dont les voiles sont
               composés par-dessus, et deux moteurs de générations différentes
               n'y répondent pas pareil. */
            className="absolute inset-0 h-full w-full object-cover will-change-transform motion-reduce:!transform-none"
            style={{ display: broken ? "none" : undefined }}
            onError={reportFailure}
          />
        )}

        <HeroScrims bottom="h-[62%]" />
      </div>

      {/* Démontée hors écran : une image floutée à 48 px sur toute la largeur,
          doublée d'un `mix-blend-mode`, reste composée à chaque image tant
          qu'elle est dans l'arbre — et on passe l'essentiel de son temps ici à
          parcourir la grille, très en dessous. */}
      {visible && (
        <HeroAmbilight
          item={featured ?? undefined}
          opacity="var(--detail-ambilight-opacity)"
          className="hero-glow absolute inset-x-0 top-0 h-[calc(32vh+350px)] md:h-[calc(36vh+350px)]"
        />
      )}

      {/* Réserve de mise en page — plus courte que celle d'une bibliothèque :
          ces pages sont des listes de travail, la grille doit rester à portée
          de regard. */}
      <div className="h-[32vh] min-h-[220px] w-full md:h-[36vh]" aria-hidden />

      <motion.div
        className="absolute inset-x-0 bottom-[18%] z-10 px-4 sm:px-8 md:px-14"
        variants={reduced ? undefined : textCascade}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={reduced ? undefined : fadeUp} className="mb-3 flex items-center gap-2.5">
          <span
            aria-hidden
            className="h-6 w-[3px] flex-shrink-0 rounded-full"
            style={{
              background: "linear-gradient(180deg, var(--brand-light), var(--brand-accent))",
              boxShadow: "0 0 12px rgba(var(--brand-rgb), 0.6)",
            }}
          />
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-on-media-secondary">
            {kicker}
          </span>
        </motion.div>

        <motion.h1
          variants={reduced ? undefined : fadeUp}
          className="titre-bibliotheque font-bold text-on-media-primary drop-shadow-[0_3px_14px_var(--on-media-shadow)]"
        >
          {title}
        </motion.h1>

        {subtitle && (
          <motion.p
            variants={reduced ? undefined : fadeUp}
            className="mt-2 text-sm font-medium text-on-media-secondary"
          >
            {subtitle}
          </motion.p>
        )}
      </motion.div>
    </section>
  );
}
