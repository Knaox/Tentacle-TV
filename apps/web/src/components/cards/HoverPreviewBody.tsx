import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { formatDuration, formatEpisodeCode } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { CardProgressBar } from "./CardProgressBar";
import { CardQuickActions } from "./CardQuickActions";
import { playTargetPath } from "./playTarget";
import { captureDetailOrigin } from "../detail/detailTransition";
import { LanguagePill, QualityChips } from "../media/MetaChips";
import { PlayIcon, StarIcon } from "../icons/HeroIcons";
import { PressableScale } from "../ui/PressableScale";
import { extractMediaQuality } from "../../lib/mediaQuality";
import { RichOverview } from "../../lib/overviewHtml";

interface HoverPreviewBodyProps {
  item: MediaItem;
  /** Image déjà chargée par la carte — reprise en mode économie de données. */
  cardImageUrl: string;
  onNavigate: () => void;
}

/**
 * Contenu du panneau d'aperçu, en deux dispositions DISTINCTES selon le format
 * de la carte survolée — et pas selon l'image disponible, comme auparavant.
 *
 *  • **Carte verticale** : l'affiche de la carte est reprise à l'identique, en
 *    2:3 sur toute la largeur du panneau, et le bloc d'informations se déplie
 *    dessous. Comme le panneau adopte la largeur exacte de la carte et son
 *    bord supérieur, l'affiche se superpose au pixel près : l'aperçu ressemble
 *    à la carte qui s'ouvre, pas à une fenêtre qui atterrit de travers.
 *    Les tentatives précédentes — affiche forcée dans un cadre 16:9, puis
 *    deux colonnes — laissaient soit une image étirée, soit une grande zone
 *    vide quand l'item n'a ni synopsis ni note (cas des lots d'épisodes).
 *
 *  • **Carte 16:9** : vignette large en bandeau, titre ou logo dessus,
 *    informations dessous. Disposition cinéma classique.
 *
 * Règle de couleurs : ce qui est posé SUR l'image reste blanc/noir constant ;
 * ce qui repose sur `--preview-panel-bg` suit les tokens thémés.
 */
export function HoverPreviewBody({ item, cardImageUrl, onNavigate }: HoverPreviewBodyProps) {
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

  const quality = useMemo(() => extractMediaQuality(item), [item]);
  const runtime = formatDuration(item.RunTimeTicks);
  const epLabel = isEpisode ? formatEpisodeCode(item.ParentIndexNumber, item.IndexNumber) : null;
  const title = isEpisode ? (item.SeriesName ?? item.Name) : item.Name;
  const addedCount = item.RecentlyAddedCount ?? 0;

  const go = (path: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    // La fiche s'ouvre depuis le PANNEAU : c'est lui que l'utilisateur regarde.
    const panel = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-preview-panel]");
    captureDetailOrigin(panel, item.Id, imageUrl, 16);
    onNavigate();
    navigate(path);
  };

  const playPath = playTargetPath(item);
  const progress = item.UserData?.PlayedPercentage;
  const hasProgress = progress != null && progress > 0 && progress < 99;

  // Le CTA de lecture n'est plus une pilule dans le tiroir : c'est l'icône
  // seule, posée en haut à gauche de la vignette. Elle y sert de repère au
  // survol sans masquer l'image, et le reste de la vignette est de toute façon
  // cliquable pour lire — le bouton ne fait que rendre l'intention visible.
  const actions = (
    <div className="flex items-center gap-1.5">
      <CardQuickActions item={item} variant="bar" />
    </div>
  );

  // Ligne méta. Un lot d'épisodes n'a ni note ni durée propres : on annonce
  // alors le nombre d'épisodes, plutôt que de laisser la ligne vide.
  const meta = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-content-tertiary">
      {addedCount > 1 ? (
        <span className="font-medium text-[var(--brand-light)]">
          {t("common:addedEpisodes", { count: addedCount })}
        </span>
      ) : (
        <>
          {item.ProductionYear && <span className="font-medium">{item.ProductionYear}</span>}
          {item.CommunityRating != null && (
            <span className="flex items-center gap-0.5 font-medium">
              <StarIcon /> {item.CommunityRating.toFixed(1)}
            </span>
          )}
          {runtime && <span>{runtime}</span>}
          {hasProgress && (
            <span className="font-medium text-[var(--brand-light)]">
              {t("common:percentWatched", { percent: Math.round(progress) })}
            </span>
          )}
        </>
      )}
      <span className="flex items-center gap-1">
        <QualityChips quality={quality} density="compact" />
        <LanguagePill labels={quality.audioLabels} max={2} />
      </span>
    </div>
  );

  // Tiroir ENTIÈREMENT cliquable vers la fiche détail — l'image, elle, lance la
  // lecture. Deux zones, deux intentions, chacune avec son propre curseur : le
  // panneau n'a donc plus besoin d'un bouton « Plus d'infos » séparé.
  const info = (
    <div
      className="flex cursor-pointer flex-col gap-2 px-3 pb-3 pt-2.5"
      data-preview-info
      role="link"
      aria-label={t("common:moreInfo")}
      onClick={go(`/media/${item.Id}`)}
    >
      {actions}
      {epLabel && (
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-content-quaternary">{epLabel}</p>
      )}
      {meta}
      {item.Overview && (
        <p className="line-clamp-2 text-[11px] leading-relaxed text-content-secondary">
          <RichOverview text={item.Overview} />
        </p>
      )}
    </div>
  );

  return (
    <>
      {/* Vignette cliquable = LECTURE. */}
      <div
        className="relative aspect-video w-full cursor-pointer overflow-hidden"
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
        {/* Icône de lecture seule, en haut à gauche : repère d'intention posé
            hors du champ du titre, qui occupe le bas de la vignette. */}
        <PressableScale
          onClick={go(playPath)}
          aria-label={t("common:play")}
          title={t("common:play")}
          className="absolute left-2.5 top-2.5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-cta-primary-border bg-cta-primary-bg text-cta-primary-fg"
          style={{ boxShadow: "var(--elev-2)" }}
        >
          <PlayIcon />
        </PressableScale>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5"
          style={{ background: "var(--card-reveal-scrim)" }}
        />
        <div className="absolute inset-x-0 bottom-0 px-3 pb-2">
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
        </div>

        {/* Progression reprise de la carte : le panneau la masquait en se
            superposant, l'utilisateur perdait de vue où il en était. */}
        <CardProgressBar percent={progress} border />
      </div>
      {/* Déroulé du bloc d'informations. `height: 0 → auto` plutôt qu'un simple
          fondu : le panneau POUSSE sa hauteur vers le bas, comme un tiroir qui
          s'ouvre sous la vignette. Le fondu seul faisait apparaître un bloc
          déjà à sa taille finale, ce qui se lisait comme un saut. */}
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        // Tiroir volontairement lent (440 ms) et décalé après le lift : c'est
        // lui qui donne le tempo du survol. À 300 ms il se dépliait en même
        // temps que la carte montait, les deux mouvements se télescopaient et
        // l'ensemble paraissait pressé.
        transition={{
          height: { duration: 0.44, ease: [0.22, 1, 0.36, 1], delay: 0.05 },
          opacity: { duration: 0.34, delay: 0.14 },
        }}
        className="overflow-hidden"
      >
        {info}
      </motion.div>
    </>
  );
}
