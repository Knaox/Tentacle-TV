import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import type { MediaItem } from "@tentacle-tv/shared";
import { HeroAmbilight } from "../hero/HeroAmbilight";
import { ArrowLeftIcon } from "../media/MediaDetailIcons";

interface DetailHeroProps {
  backdropUrl: string | null;
  /** Item dont l'affiche alimente le halo. */
  item?: MediaItem;
}

/**
 * Cinematic backdrop hero for the media detail page.
 * Includes a translucent back button + ken-burns zoom (32s ease-out alternate).
 * La qualité (4K / HDR / Dolby) n'est PAS affichée ici : elle vit à côté du
 * titre (DetailMetadata) pour ne pas surcharger la bannière.
 */
export function DetailHero({ backdropUrl, item }: DetailHeroProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");

  // Bouton retour + dégradés posés directement SUR le backdrop : restent en
  // blanc/noir dans les deux thèmes (cf. règle « posé sur média »), mais via
  // les tokens `on-media-*` / `--scrim-media-rgb` plutôt qu'en littéraux.
  return (
    // Conteneur SANS `overflow-hidden` : il ne porte que le halo, dont le
    // débordement est tout l'effet. La bannière garde le sien, un cran plus
    // bas, pour le zoom de son image.
    //
    // La bannière de la fiche est à fond perdu, contrairement à celle de
    // l'accueil : sa lumière ne peut s'échapper que par le BAS — donc juste
    // derrière le bloc titre, là où la page reprend. C'est exactement là qu'on
    // la veut, et c'est aussi pourquoi son intensité est réduite : elle passe
    // sous du texte, pas sur un fond nu.
    <div className="relative w-full">
      <HeroAmbilight item={item} opacity="var(--detail-ambilight-opacity)" />

      <div className="relative h-[70vh] w-full overflow-hidden md:h-[78vh]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t("common:back")}
          className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.45)] px-4 py-2 text-sm text-on-media-secondary backdrop-blur-md transition-colors hover:bg-[rgba(var(--scrim-media-rgb),0.65)] hover:text-on-media-primary md:left-8 md:top-8"
        >
          <ArrowLeftIcon />
          {t("common:back")}
        </button>

        {backdropUrl && (
          <motion.img
            src={backdropUrl}
            alt=""
            draggable={false}
            initial={{ opacity: 0, scale: 1.12 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 h-full w-full object-cover animate-ken-burns motion-reduce:animate-none"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}

        {/* Pile de degrades — chaines completes dans theme/scrims.css et
            theme/surfaces.css : assise NOIRE constante sous le bloc titre
            on-media dans les DEUX schemas (recette mobile, image vive — plus de
            flou ni de voile clair). Seul le voile haut suit le theme.
            Meme grammaire que la banniere d'accueil : scrim diagonal 72deg,
            voile de marque, ligne de lumiere en couture basse. */}
        <div className="absolute inset-0" style={{ background: "var(--detail-scrim-diagonal)" }} />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "var(--detail-brand-wash)" }}
          aria-hidden
        />
        <div
          className="absolute inset-x-0 bottom-0 h-[55%]"
          style={{ background: "var(--detail-scrim-bottom)" }}
        />
        {/* Raccord bas vers la page — `none` en sombre, fondu opaque a 55 % du
            calque en clair (la meta themee sous le titre repose sur la page). */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[16%]"
          style={{ background: "var(--detail-page-fade)" }}
          aria-hidden
        />
        <div
          className="absolute inset-x-0 top-0 h-32"
          style={{ background: "var(--detail-scrim-top)" }}
        />
        {/* PAS de ligne de lumière ici, contrairement à la bannière d'accueil.
            Sur cette page le bloc titre remonte de 192 px (`-mt-48` dans
            MediaDetail) : la couture du hero passe donc EN PLEIN MILIEU du
            contenu, et la hairline y traçait un trait violet en travers du
            synopsis. Le raccord n'a rien à souligner quand il est recouvert. */}
      </div>
    </div>
  );
}
