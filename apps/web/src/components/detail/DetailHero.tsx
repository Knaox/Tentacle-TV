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
    /**
     * Deux boîtes distinctes, et c'est tout l'enjeu.
     *
     * La boîte de MISE EN PAGE (la seule qui occupe de la place dans le flux)
     * mesure 70/78 vh. La boîte IMAGE, elle, déborde de 260 px en dessous.
     *
     * Tant que les deux se confondaient, l'image devait finir de s'éteindre
     * avant son propre bord : le dégradé passait de visible à noir opaque en une
     * centaine de pixels, ce qui se lit comme une bande — d'autant plus nette
     * que l'affiche est lumineuse. Avec 260 px de rab, le fondu se déroule sous
     * le bloc titre puis se termine dans le vide, là où personne ne le voit. Le
     * bloc titre repose alors sur une image qui s'estompe, jamais sur un aplat.
     *
     * Aucun `overflow-hidden` sur le conteneur : le halo et le débord de la
     * boîte image en dépendent.
     */
    <div className="relative w-full">
      <HeroAmbilight
        item={item}
        opacity="var(--detail-ambilight-opacity)"
        className="absolute inset-x-0 top-0 -bottom-[260px]"
      />

      <div className="absolute inset-x-0 top-0 -bottom-[260px] overflow-hidden">
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
            // 700 ms au lieu de 1400 : le backdrop est la première chose que
            // l'œil cherche en arrivant, le faire attendre une seconde et demie
            // pour finir de se poser n'ajoutait rien. Le ken burns, lui, garde
            // ses 32 s — c'est une respiration, pas une entrée.
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
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
        {/* 74 % de la boîte IMAGE (qui déborde de 260 px) : le fondu court donc
            bien au-delà du bas visible de la bannière et n'a plus à se terminer
            dans un mouchoir de poche. */}
        <div
          className="absolute inset-x-0 bottom-0 h-[74%]"
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

      {/* Réserve de mise en page : c'est ELLE qui occupe la place dans le flux,
          la boîte image étant hors flux. Le bloc titre de `MediaDetail` remonte
          par rapport à ce bord-ci, pas par rapport au bas de l'image. */}
      <div className="h-[70vh] w-full md:h-[78vh]" aria-hidden />
    </div>
  );
}
