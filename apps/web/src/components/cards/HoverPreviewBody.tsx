import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { CardProgressBar } from "./CardProgressBar";
import { HoverPreviewInfo } from "./HoverPreviewInfo";
import { playTargetPath } from "./playTarget";
import type { PreviewDirection } from "./hoverPreviewGeometry";
import { captureDetailOrigin } from "../detail/detailTransition";
import { PlayIcon } from "../icons/HeroIcons";
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
 * près à la carte survolée, et un tiroir d'informations qui se déroule à côté.
 *
 * Le SENS du déroulé dépend de la place disponible (`direction`) :
 *  • `down` — cas nominal, le tiroir descend sous la vignette ;
 *  • `up` — carte proche du bas de la fenêtre : le tiroir monte au-dessus.
 *    C'est le placement « flip » classique des surfaces flottantes. Dans les
 *    deux cas la VIGNETTE ne bouge pas : le panneau reste rigoureusement sur sa
 *    carte, ce qui était jusqu'ici obtenu en refusant purement et simplement de
 *    l'ouvrir sur les cartes basses.
 *
 * Règle de couleurs : ce qui est posé SUR l'image reste blanc/noir constant ;
 * ce qui repose sur `--preview-panel-bg` suit les tokens thémés.
 */
export function HoverPreviewBody({ item, cardImageUrl, direction, onNavigate }: HoverPreviewBodyProps) {
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

  // Vignette cliquable = LECTURE (le tiroir, lui, mène à la fiche).
  const visual = (
    <div
      data-preview-visual
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
  );

  // Déroulé du bloc d'informations. `height: 0 → auto` plutôt qu'un simple
  // fondu : le panneau POUSSE sa hauteur, comme un tiroir qui s'ouvre. Le fondu
  // seul faisait apparaître un bloc déjà à sa taille finale, ce qui se lisait
  // comme un saut. En déploiement `up`, la même animation fait grandir le
  // panneau vers le haut — il est alors ancré par son bord bas.
  const drawer = (
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
      <HoverPreviewInfo item={item} onOpenDetail={go(`/media/${item.Id}`)} />
    </motion.div>
  );

  return direction === "down" ? (
    <>
      {visual}
      {drawer}
    </>
  ) : (
    <>
      {drawer}
      {visual}
    </>
  );
}
