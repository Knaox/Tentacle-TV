import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import type { MediaItem } from "@tentacle-tv/shared";
import { HeroAmbilight } from "../hero/HeroAmbilight";
import { AmbilightLayer } from "../hero/AmbilightLayer";
import { ArrowLeftIcon } from "../media/MediaDetailIcons";
import { useInViewport } from "../../hooks/useInViewport";
import { useBrokenImage } from "../../hooks/useBrokenImage";
import {
  DETAIL_STAGE_BOX,
  DETAIL_STAGE_FOCUS,
  DETAIL_STAGE_GLOW_BOX,
  DETAIL_STAGE_LAYERS,
  DETAIL_STAGE_MIN_H,
} from "./detailStageGeometry";

interface DetailStageProps {
  backdropUrl: string | null;
  /** Item dont le décor alimente la lueur de raccord. */
  item: MediaItem;
  /**
   * Le décor est là d'emblée, sans sa mise en place : calque d'ouverture en
   * charge, sortie du lecteur, lien direct (cf. `skipsEntrance`).
   */
  instant?: boolean;
  /** Ouvre la vue « image plein écran » ; absent = pas d'images à montrer. */
  onOpenImages?: () => void;
  /** Le bloc titre, posé en bas de la scène. */
  children: ReactNode;
  /** Retour sur mesure (page partagée : la liste, pas l'historique). */
  onBack?: () => void;
  backLabel?: string;
  /**
   * Source de la lueur de raccord, quand elle ne vient pas de Jellyfin : la
   * fiche d'un titre gardé la tire du décor posé sur le disque. `undefined` =
   * celle de l'item, par le serveur.
   */
  glowUrl?: string | null;
}

/**
 * Durée de la mise en place du décor : UNE fois, à l'arrivée, puis l'image ne
 * bouge plus. L'ancien ken burns tournait en boucle (32 s aller-retour) tant
 * que la bannière était visible ; la consigne de cette refonte est qu'aucune
 * image plein cadre ne soit retravaillée en permanence. La respiration est
 * gardée, sous forme d'un seul dézoom lent qui se termine.
 */
const SETTLE_S = 1.6;
const SETTLE_EASE = [0.16, 1, 0.3, 1] as const;

/**
 * La scène de la fiche : le décor sur tout le premier écran, le bloc titre
 * posé en bas à gauche, le retour et « Voir les images » dans les coins hauts.
 *
 * Deux boîtes, comme l'ancienne bannière : la boîte IMAGE, hors flux, déborde
 * de 260 px sous la scène pour que le fondu vers la page se fasse sous la
 * ligne de flottaison ; la scène elle-même, dans le flux, fixe la hauteur et
 * porte le contenu (`justify-end`). Aucun `overflow-hidden` sur l'ensemble :
 * la lueur et le débord en dépendent.
 *
 * Tout ce qui est posé ici l'est sur le décor : jetons `on-media` dans les deux
 * thèmes. Un seul `backdrop-filter` par contrôle de coin — ils sont petits et
 * floutent réellement une image vivante.
 */
export function DetailStage({ backdropUrl, item, instant = false, onOpenImages, children, onBack, backLabel, glowUrl }: DetailStageProps) {
  const navigate = useNavigate();
  const { t } = useTranslation(["common", "media"]);
  // La lueur est une image floutée en fusion `screen` : démontée hors champ
  // (« si pas affiché, on ne consomme rien »), remontée 200 px avant d'y
  // revenir pour qu'on ne surprenne jamais son fondu.
  const { ref: boxRef, visible } = useInViewport<HTMLDivElement>("200px");
  const { broken, reportFailure } = useBrokenImage(backdropUrl);
  // Mouvement réduit : le décor arrive en fondu, sans dézoom.
  const reduced = useReducedMotion();

  return (
    <section className={`relative flex w-full flex-col justify-end ${DETAIL_STAGE_MIN_H}`} aria-label={item.Name}>
      <div ref={boxRef} className={`pointer-events-none absolute inset-x-0 top-0 overflow-hidden ${DETAIL_STAGE_BOX}`}>
        {backdropUrl && !broken && (
          <motion.img
            src={backdropUrl}
            alt=""
            draggable={false}
            initial={instant ? false : reduced ? { opacity: 0 } : { opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ opacity: { duration: 0.6, ease: "easeOut" }, scale: { duration: SETTLE_S, ease: SETTLE_EASE } }}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: DETAIL_STAGE_FOCUS }}
            onError={reportFailure}
          />
        )}
        {DETAIL_STAGE_LAYERS.map((layer) => (
          <div key={layer.background} className={layer.className} style={{ background: layer.background }} aria-hidden />
        ))}
      </div>

      {/* Lueur de raccord : peinte AVANT le bloc titre, le texte n'est jamais
          touché par la fusion. */}
      {visible && (glowUrl === undefined ? (
        <HeroAmbilight
          item={item}
          opacity="var(--detail-ambilight-opacity)"
          className={`hero-glow pointer-events-none absolute inset-x-0 top-0 ${DETAIL_STAGE_GLOW_BOX}`}
        />
      ) : (
        <AmbilightLayer
          url={glowUrl}
          layerKey={item.Id}
          opacity="var(--detail-ambilight-opacity)"
          className={`hero-glow pointer-events-none absolute inset-x-0 top-0 ${DETAIL_STAGE_GLOW_BOX}`}
        />
      ))}

      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-4 md:px-8 md:pt-8">
        <StageButton onClick={onBack ?? (() => navigate(-1))} label={backLabel ?? t("common:back")} icon={<ArrowLeftIcon />} showLabel />
        {onOpenImages && (
          <StageButton onClick={onOpenImages} label={t("media:detailViewImages")} icon={<ImagesIcon />} />
        )}
      </div>

      <div className="relative z-10">{children}</div>
    </section>
  );
}

function StageButton({ onClick, label, icon, showLabel = false }: {
  onClick: () => void;
  label: string;
  icon: ReactNode;
  showLabel?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-11 items-center gap-2 rounded-full border border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.42)] text-sm font-medium text-on-media-secondary backdrop-blur-md transition-colors duration-150 hover:bg-[rgba(var(--scrim-media-rgb),0.62)] hover:text-on-media-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] ${
        showLabel ? "px-4" : "w-11 justify-center"
      }`}
    >
      {icon}
      {showLabel && <span>{label}</span>}
    </button>
  );
}

function ImagesIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <path d="M8 15l2.5-3 2 2.2L15 11l2 4H8z" />
    </svg>
  );
}
