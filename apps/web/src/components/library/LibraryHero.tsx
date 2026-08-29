import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { useJellyfinClient, useLatestItems, useRandomLibraryBackdrop } from "@tentacle-tv/api-client";
import { HeroAmbilight } from "../hero/HeroAmbilight";
import { firstBackdropItem, heroBackdropUrl, resolveBackdropId } from "../hero/resolveBackdrop";
import { fadeUp, textCascade } from "../../theme/motion";
import { useInViewport } from "../../hooks/useInViewport";
import { useBrokenImage } from "../../hooks/useBrokenImage";
import { HeroScrims } from "../hero/HeroScrims";

interface LibraryHeroProps {
  libraryId: string;
  libraryName: string;
  collectionType?: string;
}

/**
 * En-tête de page bibliothèque : même grammaire que la bannière d'accueil
 * (scrim diagonal, voile de marque, ligne de lumière), en version courte —
 * la page est un catalogue, pas une vitrine, la grille doit rester à portée
 * de regard sans défilement.
 *
 * Le backdrop est un item ALÉATOIRE de la bibliothèque (`useRandomLibraryBackdrop`),
 * tiré une fois par session puis mis en cache — pas d'appel à chaque visite.
 * Repli sur le premier des « Derniers ajouts » (`useLatestItems`, souvent déjà
 * en cache) quand le tirage ne renvoie rien — petite bibliothèque, aucun backdrop.
 */
export function LibraryHero({ libraryId, libraryName, collectionType }: LibraryHeroProps) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const reduced = useReducedMotion();
  const { data: randomItem } = useRandomLibraryBackdrop(libraryId);
  const { data: latest } = useLatestItems(libraryId, { collectionType });
  // Bannière réellement à l'écran ET fenêtre au premier plan — sert à démonter
  // le halo flouté dès qu'on défile dans la grille (cf. plus bas).
  const { ref: boxRef, visible } = useInViewport<HTMLDivElement>("200px");

  const featured = randomItem ?? firstBackdropItem(latest);
  const backdropId = featured ? resolveBackdropId(featured) : null;
  const { broken, reportFailure } = useBrokenImage(backdropId ?? undefined);
  // La MÊME URL que l'accueil, à la lettre — `heroBackdropUrl` est la
  // définition unique. Elle était recopiée ici à la main, et la copie avait
  // dérivé d'un cran de qualité (82 contre 85). Trois pixels de moins par bloc
  // JPEG dans un dégradé sombre, c'est exactement là que ça se voit ; et un
  // second jeu de paramètres, c'est un second téléchargement là où le cache
  // aurait suffi.
  const url = heroBackdropUrl(client, featured ?? undefined);

  return (
    /**
     * Même construction que la bannière de fiche média : une boîte de MISE EN
     * PAGE (44/48 vh) et une boîte IMAGE qui déborde de 200 px en dessous.
     *
     * Confondues, l'image devait finir de s'éteindre avant son propre bord et le
     * dégradé passait de visible à opaque en une centaine de pixels — la bande
     * signalée. Avec du rab, le fondu se termine sous la barre de filtres, là où
     * personne ne le voit.
     */
    <section className="relative w-full" aria-label={libraryName}>
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
            /* `will-change-transform` comme sur l'accueil, et pour la même
               raison : la promotion en couche décide de la façon dont les
               voiles sont composés par-dessus. Sans elle, les deux bannières
               n'empruntaient pas le même chemin de composition — et deux
               moteurs de générations différentes n'y répondent pas pareil. */
            className="absolute inset-0 h-full w-full object-cover will-change-transform motion-reduce:!transform-none"
            style={{ display: broken ? "none" : undefined }}
            onError={reportFailure}
          />
        )}

        {/* La MÊME pile que l'accueil, au sens propre : le même composant, les
            mêmes cotes. Elle en différait sur deux points, tous deux mesurés
            comme coûteux sur une dalle.

            La rampe basse valait `h-[76%]`, dimensionnée pour une boîte qui
            DÉBORDE de 200 px sous le bas visible : ses quinze derniers pour
            cent, la montée vers l'opaque, tombaient hors champ. Sur le
            téléviseur la carte s'arrête à son bord (`bibliotheque-tv.css`) et
            la même montée se jouait dans les cinquante derniers pixels — une
            rampe vingt pour cent plus raide que celle de l'accueil, donc des
            paliers là où l'accueil n'en a pas. On reprend sa proportion.

            Et le raccord de page en plus. En thème sombre son jeton vaut
            `none` sur le web : le calque ne peignait rien, et personne ne l'a
            vu dériver. La feuille du téléviseur, elle, le redéfinit en vrai
            dégradé — d'où une SIXIÈME couche quantifiée sur huit bits empilée
            sur les cinq autres, dans la zone la plus sombre de l'image. */}
        <HeroScrims bottom="h-[62%]" />
      </div>

      {/* Lueur de raccord — l'affiche floutée en fusion `screen` par-dessus le
          bas de la bannière (cf. `.hero-glow`). Boîte calée pour que la couture
          (bas de la boîte image, +200 px) tombe dans la zone pleine du masque,
          avec 150 px de débord dans la page. */}
      {/* Démontée hors écran, comme sur l'accueil et la fiche média — c'est la
          dernière des trois bannières où elle restait montée en toutes
          circonstances. Une image floutée à 48 px étalée sur toute la largeur,
          doublée d'un `mix-blend-mode`, reste composée à chaque image tant
          qu'elle est dans l'arbre, même parfaitement immobile ; or on passe
          l'essentiel de son temps sur cette page à parcourir la grille, très
          en dessous. La marge de 200 px du hook la remonte AVANT l'entrée dans
          le champ, pour qu'on ne surprenne jamais son fondu d'apparition. */}
      {visible && (
        <HeroAmbilight
          item={featured ?? undefined}
          opacity="var(--detail-ambilight-opacity)"
          className="hero-glow absolute inset-x-0 top-0 h-[calc(44vh+350px)] md:h-[calc(48vh+350px)]"
        />
      )}

      {/* Réserve de mise en page : la boîte image étant hors flux, c'est elle
          qui occupe la place et sur laquelle la barre de filtres s'appuie. */}
      <div className="h-[44vh] min-h-[300px] w-full md:h-[48vh]" aria-hidden />

      {/* Titre ancré sur la RÉSERVE, pas sur la boîte image : celle-ci déborde
          de 200 px, un `bottom-[18%]` calculé dessus aurait fait descendre le
          titre d'autant. */}
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
          {/* Le nom de la bibliothèque juste dessous dit déjà « Films » ou
              « Séries » : le sur-titre reste un libellé de section neutre,
              traduit, plutôt qu'un doublon dérivé du collectionType. */}
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-on-media-secondary">
            {t("common:librariesTitle")}
          </span>
        </motion.div>

        <motion.h1
          variants={reduced ? undefined : fadeUp}
          className="titre-bibliotheque font-bold text-on-media-primary drop-shadow-[0_3px_14px_var(--on-media-shadow)]"
        >
          {libraryName}
        </motion.h1>
      </motion.div>
    </section>
  );
}
