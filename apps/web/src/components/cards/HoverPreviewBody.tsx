import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { CardProgressBar } from "./CardProgressBar";
import { CardQuickActions } from "./CardQuickActions";
import { HoverPreviewInfo } from "./HoverPreviewInfo";
import { playTargetPath } from "./playTarget";
import type { PreviewDirection } from "./hoverPreviewGeometry";
import { captureDetailOrigin } from "../detail/detailTransition";
import { InfoIcon } from "../icons/HeroIcons";
import { PressableScale } from "../ui/PressableScale";

interface HoverPreviewBodyProps {
  item: MediaItem;
  /** Image déjà chargée par la carte — reprise telle quelle. */
  cardImageUrl: string;
  /** Sens de déploiement du tiroir, résolu par la géométrie du panneau. */
  direction: PreviewDirection;
  onNavigate: () => void;
}

/**
 * Contenu du panneau d'aperçu : une vignette 16:9 qui se superpose au pixel
 * près à la carte survolée, et un bloc d'informations dont la place dépend de
 * `direction` :
 *  • `down` — cas nominal, il se déroule SOUS la vignette, dans l'espace libre
 *    entre deux rangées ;
 *  • `overlay` — pas de place dessous, ou carte rognée par le bord de la
 *    rangée : il se pose SUR la vignette, en voile translucide, et le panneau
 *    ne dépasse alors pas d'un pixel de la carte.
 *
 * Règle de couleurs : ce qui est posé SUR l'image reste blanc/noir constant ;
 * ce qui repose sur `--preview-panel-bg` suit les tokens thémés. En `overlay`
 * le bloc d'infos est POSÉ SUR l'image — il passe donc en on-media, avec un
 * voile assez opaque pour tenir le contraste sans effacer le visuel.
 *
 * `memo` : le panneau suit sa carte au défilement, donc son conteneur se
 * repositionne à chaque image. Sans cette barrière, tout ce contenu — vignette,
 * logo, tiroir, chips de qualité — serait reconstruit soixante fois par seconde
 * pour un déplacement qui ne concerne que deux propriétés de style du parent.
 */
export const HoverPreviewBody = memo(function HoverPreviewBody({
  item,
  cardImageUrl,
  direction,
  onNavigate,
}: HoverPreviewBodyProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const client = useJellyfinClient();

  const isEpisode = item.Type === "Episode";
  // TOUJOURS l'image de la carte, jamais une seconde version. C'est ce qui rend
  // l'ouverture invisible : le panneau se superpose à un pixel déjà affiché et
  // déjà en cache, donc aucun clignotement, aucun recadrage, aucun octet
  // supplémentaire — l'économie de données n'a même plus à être consultée.
  const imageUrl = cardImageUrl;

  const logoUrl = item.ImageTags?.Logo
    ? client.getImageUrl(isEpisode ? (item.SeriesId ?? item.Id) : item.Id, "Logo", { width: 300, quality: 90 })
    : null;

  const title = isEpisode ? (item.SeriesName ?? item.Name) : item.Name;
  const progress = item.UserData?.PlayedPercentage;

  const go = (path: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    // La fiche s'ouvre depuis la VIGNETTE du panneau, pas depuis le panneau
    // entier. Le rectangle capturé sert de cadre à une image en `object-cover` :
    // en prenant le panneau, on lui donnait la hauteur du tiroir DÉPLIÉ (≈ 300 ×
    // 313 pour une image 16:9), et le visuel partait donc violemment recadré,
    // pour ne retrouver ses proportions qu'à l'atterrissage.
    const panel = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-preview-panel]");
    captureDetailOrigin(panel?.querySelector<HTMLElement>("[data-preview-visual]") ?? null, item.Id, imageUrl, 12);
    onNavigate();
    navigate(path);
  };

  const playPath = playTargetPath(item);

  const overlay = direction === "overlay";

  const titleBlock = (
    <>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={title}
          draggable={false}
          className="h-8 max-w-[62%] object-contain object-left drop-shadow-[0_2px_10px_var(--on-media-shadow)]"
        />
      ) : (
        <p className="line-clamp-2 text-sm font-bold leading-tight text-on-media-primary drop-shadow-[0_2px_8px_var(--on-media-shadow)]">
          {title}
        </p>
      )}
      {/* Titre de l'ÉPISODE. `title` porte le nom de la série — c'est lui qui
          situe le média —, mais l'aperçu d'un épisode ne disait nulle part
          duquel il s'agissait : le code S/E figure dans la ligne méta, le titre
          n'apparaissait pas du tout. Une ligne de plus, la place existe. */}
      {isEpisode && item.Name && item.Name !== title && (
        <p className="line-clamp-1 text-xs font-medium text-on-media-secondary drop-shadow-[0_1px_6px_var(--on-media-shadow)]">
          {item.Name}
        </p>
      )}
    </>
  );

  /**
   * Voile d'informations POSÉ SUR la vignette — disposition superposée.
   *
   * Il remplace un tiroir qui se dépliait vers le haut quand la place manquait
   * en bas. Le geste était géométriquement juste mais recouvrait le titre de la
   * rangée du dessus, et un tiroir qui s'ouvre vers le haut sur certaines cartes
   * et vers le bas sur d'autres se lit comme une incohérence. Ici rien ne sort
   * de la carte : c'est la carte elle-même qui révèle ses informations.
   *
   * Translucide et légèrement flouté : l'image reste lisible derrière, ce qui
   * maintient le lien avec le média — un aplat opaque aurait juste remplacé la
   * vignette par une fiche. Le flou porte sur un cinquième de carte, sans
   * commune mesure avec le `backdrop-filter` plein panneau qu'il a fallu retirer.
   */
  const infoOverlay = (
    <motion.div
      className="absolute inset-x-0 bottom-0 z-[5]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: 0.04 }}
      style={{
        background: "var(--preview-overlay-bg)",
        backdropFilter: "blur(var(--preview-overlay-blur))",
        WebkitBackdropFilter: "blur(var(--preview-overlay-blur))",
      }}
    >
      <div className="px-3 pt-2">{titleBlock}</div>
      <HoverPreviewInfo
        item={item}
        tone="media"
        compact
        onOpenDetail={go(`/media/${item.Id}`)}
      />
    </motion.div>
  );

  /**
   * Actions rapides en superposition : dans le COIN de la vignette et non dans
   * le voile. Une rangée de trois pastilles de 36 px y ajoutait une quatrième
   * ligne, et le voile finissait par manger plus de la moitié de l'image —
   * l'aperçu ne montrait plus le média qu'il est censé faire voir. Au coin
   * elles ne coûtent aucune hauteur, et c'est déjà leur place sur les cartes
   * qui n'ont pas de panneau.
   */
  const cornerActions = (
    <div className="absolute right-2 top-2 z-10" onClick={(e) => e.stopPropagation()}>
      <CardQuickActions item={item} variant="bar" />
    </div>
  );

  // Vignette cliquable = LECTURE (le bloc d'infos, lui, mène à la fiche).
  // En `overlay` elle occupe TOUTE la hauteur du panneau — donc exactement la
  // carte — au lieu d'imposer son ratio 16:9 : la carte est déjà en 16:9, et
  // laisser les deux le calculer chacun de leur côté produisait un écart d'un
  // pixel selon les arrondis.
  const visual = (
    <div
      key="visual"
      data-preview-visual
      className={`relative w-full cursor-pointer overflow-hidden ${overlay ? "h-full" : "aspect-video"}`}
      role="button"
      aria-label={`${t("common:play")} — ${title}`}
      onClick={go(playPath)}
    >
      {/* `<img>` nu, PAS `CardImage`. Ce dernier masque l'image jusqu'à son
          `onLoad` (opacité 0 + squelette) : comme le panneau crée un nouvel
          élément, le handler repassait par zéro même pour une image déjà en
          cache — d'où un clignotement noir d'une frame à chaque survol.
          Ici la source est strictement celle de la carte, donc déjà décodée :
          elle peint immédiatement, il n'y a rien à masquer. */}
      <img
        src={imageUrl}
        alt={item.Name}
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Bouton « Plus d'infos », en haut à gauche : il ouvre la FICHE, avec la
          même transition que partout (`go` capture l'origine sur la vignette).
          Il a remplacé le bouton Lecture — la vignette entière lance déjà la
          lecture au clic, l'y répéter par un bouton faisait doublon, alors que
          rien ne signalait l'accès à la fiche. Les deux intentions ont chacune
          leur cible : l'image pour lire, ce bouton (et le tiroir) pour la fiche.
          `stopPropagation` empêche le clic de retomber sur la vignette-lecture. */}
      <PressableScale
        onClick={go(`/media/${item.Id}`)}
        aria-label={t("common:moreInfo")}
        title={t("common:moreInfo")}
        className="absolute left-2.5 top-2.5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.5)] text-on-media-primary backdrop-blur-sm transition-colors hover:bg-[rgba(var(--scrim-media-rgb),0.7)]"
        style={{ boxShadow: "var(--elev-2)" }}
      >
        <InfoIcon className="h-5 w-5" />
      </PressableScale>

      {/* Scrim + titre du bas : uniquement en `down`. En `overlay` c'est le
          voile d'informations qui occupe cette zone, et il porte déjà le titre —
          les empiler donnait deux fois le même texte à quelques pixels près. */}
      {!overlay && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5"
            style={{ background: "var(--card-reveal-scrim)" }}
          />
          <div className="absolute inset-x-0 bottom-0 px-3 pb-2">{titleBlock}</div>
        </>
      )}

      {overlay && cornerActions}
      {overlay && infoOverlay}

      {/* Progression reprise de la carte : le panneau la masquait en se
          superposant, l'utilisateur perdait de vue où il en était. */}
      <CardProgressBar percent={progress} border />
    </div>
  );

  // Déroulé du bloc d'informations. `height: 0 → auto` : le tiroir POUSSE sa
  // hauteur, comme un tiroir qui s'ouvre. Sa taille est désormais stable — le
  // synopsis est tronqué à UNE ligne (`line-clamp-1`), il ne peut plus la faire
  // varier de plusieurs lignes.
  const drawer = (
    <motion.div
      key="drawer"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      // 300 ms, légèrement décalé après le lift. À 440 ms le tiroir donnait le
      // tempo du survol, et ce tempo était trop lent : on avait fini de lire la
      // vignette avant qu'il ne soit ouvert. Le décalage subsiste — sans lui les
      // deux mouvements se télescopent — mais il est resserré d'autant.
      transition={{
        height: { duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: 0.03 },
        opacity: { duration: 0.24, delay: 0.09 },
      }}
      className="overflow-hidden"
    >
      <HoverPreviewInfo item={item} onOpenDetail={go(`/media/${item.Id}`)} />
    </motion.div>
  );

  // Clés explicites : la disposition peut basculer EN COURS de survol (la page
  // défile, la carte remonte et libère la place en bas). Sans clés, React
  // réconcilierait par position et démonterait la vignette pour la remonter, ce
  // qui referait clignoter l'image.
  return (
    <>
      {visual}
      {!overlay && drawer}
    </>
  );
});
