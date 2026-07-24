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
 * Géométrie de la bannière, PARTAGÉE avec le calque d'ouverture
 * (`DetailOpenOverlay`), qui monte les mêmes couches à l'avance pour que son
 * effacement soit invisible. C'est toute la raison d'être de ces constantes :
 * tant que les valeurs étaient recopiées de part et d'autre, il a suffi de
 * changer la hauteur d'un scrim d'un côté pour que le décor saute à
 * l'atterrissage de CHAQUE ouverture de fiche.
 */
/** Réserve de mise en page : la seule qui occupe de la place dans le flux. */
export const DETAIL_HERO_HEIGHT = "h-[70vh] md:h-[78vh]";
/**
 * Boîte IMAGE = réserve + 260 px de débord vers le bas, hors flux.
 *
 * Tant que les deux se confondaient, l'image devait finir de s'éteindre avant
 * son propre bord : le dégradé passait de visible à opaque en une centaine de
 * pixels, ce qui se lit comme une bande — d'autant plus nette que l'affiche est
 * lumineuse. Avec du rab, le fondu se déroule sous le bloc titre puis se termine
 * dans le vide, là où personne ne le voit.
 */
export const DETAIL_HERO_BOX = "h-[calc(70vh+260px)] md:h-[calc(78vh+260px)]";
/** Part de la boîte IMAGE occupée par le fondu bas. */
export const DETAIL_SCRIM_BOTTOM = "h-[74%]";

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
    // Deux boîtes distinctes (cf. `DETAIL_HERO_HEIGHT` / `DETAIL_HERO_BOX`), et
    // aucun `overflow-hidden` sur le conteneur : le halo et le débord de la
    // boîte image en dépendent.
    <div className="relative w-full">
      <HeroAmbilight
        item={item}
        opacity="var(--detail-ambilight-opacity)"
        className={`absolute inset-x-0 top-0 ${DETAIL_HERO_BOX}`}
      />

      <div className={`absolute inset-x-0 top-0 overflow-hidden ${DETAIL_HERO_BOX}`}>
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
        <div
          className={`absolute inset-x-0 bottom-0 ${DETAIL_SCRIM_BOTTOM}`}
          style={{ background: "var(--detail-scrim-bottom)" }}
        />
        {/* Raccord vers la page — `none` en sombre, fondu vers la couleur de
            page en clair. Il est passé de 16 % à 46 % de la boîte : en thème
            clair, la méta, le synopsis et les genres sous le titre sont en
            texte THÉMÉ, donc sombre, et depuis que l'image se prolonge sous eux
            ils se retrouvaient posés dessus — illisibles sur une affiche vive.
            C'est ce calque qui leur rend leur assise de page. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%]"
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
      <div className={`w-full ${DETAIL_HERO_HEIGHT}`} aria-hidden />
    </div>
  );
}
