import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { useJellyfinClient, useLatestItems } from "@tentacle-tv/api-client";
import { HeroAmbilight } from "../hero/HeroAmbilight";
import { firstBackdropItem, resolveBackdropId } from "../hero/resolveBackdrop";
import { fadeUp, textStagger } from "../../theme/motion";

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
 * Le backdrop réutilise `useLatestItems`, déjà en cache : l'accueil a chargé
 * cette même requête pour la rangée « Derniers ajouts » de la bibliothèque, et
 * la clé TanStack Query est identique. Arriver ici ne déclenche donc aucun
 * appel réseau supplémentaire dans le cas courant.
 */
export function LibraryHero({ libraryId, libraryName, collectionType }: LibraryHeroProps) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const reduced = useReducedMotion();
  const { data: items } = useLatestItems(libraryId, { collectionType });

  const featured = firstBackdropItem(items);
  const backdropId = featured ? resolveBackdropId(featured) : null;
  const url = backdropId
    ? client.getImageUrl(backdropId, "Backdrop", { width: 1920, quality: 82 })
    : null;

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
      <HeroAmbilight
        item={featured ?? undefined}
        opacity="var(--detail-ambilight-opacity)"
        className="absolute inset-x-0 top-0 -bottom-[200px]"
      />

      <div className="absolute inset-x-0 top-0 -bottom-[200px] overflow-hidden">
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
            className="absolute inset-0 h-full w-full object-cover motion-reduce:!transform-none"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}

        {/* Même pile que la bannière d'accueil, cf. theme/surfaces.css. */}
        <div className="absolute inset-0" style={{ background: "var(--hero-scrim-diagonal)" }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: "var(--hero-brand-wash)" }} aria-hidden />
        {/* 76 % de la boîte IMAGE (qui déborde de 200 px) : le fondu court
            au-delà du bas visible de la bannière. */}
        <div className="absolute inset-x-0 bottom-0 h-[76%]" style={{ background: "var(--hero-scrim-bottom)" }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%]" style={{ background: "var(--hero-page-fade)" }} aria-hidden />
        <div className="absolute inset-x-0 top-0 h-40" style={{ background: "var(--hero-scrim-top)" }} />
        <div className="noise-texture absolute inset-0 opacity-[0.06]" aria-hidden />
        {/* Pas de ligne de lumière : la grille remonte de 40-56 px, la couture
            tombe donc derrière la barre de recherche. Même piège que sur la
            fiche média — une hairline sous du contenu se lit comme une rayure. */}

      </div>

      {/* Réserve de mise en page : la boîte image étant hors flux, c'est elle
          qui occupe la place et sur laquelle la barre de filtres s'appuie. */}
      <div className="h-[44vh] min-h-[300px] w-full md:h-[48vh]" aria-hidden />

      {/* Titre ancré sur la RÉSERVE, pas sur la boîte image : celle-ci déborde
          de 200 px, un `bottom-[18%]` calculé dessus aurait fait descendre le
          titre d'autant. */}
      <motion.div
        className="absolute inset-x-0 bottom-[18%] z-10 px-4 sm:px-8 md:px-14"
        variants={reduced ? undefined : textStagger()}
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
          className="font-bold text-on-media-primary drop-shadow-[0_3px_14px_var(--on-media-shadow)] tracking-tight"
          style={{ fontSize: "clamp(2rem, 4.2vw, 3.5rem)", lineHeight: 1.05, letterSpacing: "-0.028em" }}
        >
          {libraryName}
        </motion.h1>
      </motion.div>
    </section>
  );
}
