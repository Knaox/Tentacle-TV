import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CornersOutIcon } from "@phosphor-icons/react/dist/csr/CornersOut";
import type { MediaItem } from "@tentacle-tv/shared";
import { HeroAmbilight } from "../hero/HeroAmbilight";
import { AmbilightLayer } from "../hero/AmbilightLayer";
import { ArrowLeftIcon } from "../media/MediaDetailIcons";
import { useInViewport } from "../../hooks/useInViewport";
import { useBrokenImage } from "../../hooks/useBrokenImage";
import { DetailStageFallback } from "./DetailArtworkFallback";
import { GlassButton } from "../ui/glass/GlassButton";
import { BackButton } from "../ui/BackButton";
import { useLiquidGlassMode } from "../../theme/glass";
import { itemImageColor } from "../../lib/itemImageColor";
import { useLateReveal } from "./detailArrival";
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
 * La scène de la fiche : le décor sur tout le premier écran, le bloc titre
 * posé en bas à gauche, le retour et « Voir les images » dans les coins hauts.
 *
 * Deux boîtes, comme l'ancienne bannière : la boîte IMAGE, hors flux, déborde
 * de 260 px sous la scène pour que le fondu vers la page se fasse sous la
 * ligne de flottaison ; la scène elle-même, dans le flux, fixe la hauteur et
 * porte le contenu (`justify-end`). Aucun `overflow-hidden` sur l'ensemble :
 * la lueur et le débord en dépendent.
 *
 * Le décor ne se « met plus en place » : sa COULEUR d'abord (le blurhash de l'image, peint sous
 * elle), puis l'image — là d'emblée si la fiche l'attendait décodée (`useDetailArrival`), en UN
 * fondu de 300 ms si elle arrive après (`useLateReveal`). Plus de fondu de 0,6 s ni de dézoom
 * de 1,6 s rejoués à chaque fiche (refonte de nov. 2026).
 *
 * Tout ce qui est posé ici l'est sur le décor : jetons `on-media` dans les deux thèmes. Les
 * contrôles de coin sont les pilules du socle (`.btn-on-media`), sans flou ; sous le verre
 * natif, les mêmes formes passent par la primitive.
 */
export function DetailStage({ backdropUrl, item, instant = false, onOpenImages, children, onBack, backLabel, glowUrl }: DetailStageProps) {
  const navigate = useNavigate();
  const { t } = useTranslation(["common", "media"]);
  // La lueur est une image floutée en fusion `screen` : démontée hors champ
  // (« si pas affiché, on ne consomme rien »), remontée 200 px avant d'y
  // revenir pour qu'on ne surprenne jamais son fondu.
  const { ref: boxRef, visible } = useInViewport<HTMLDivElement>("200px");
  const { broken, reportFailure } = useBrokenImage(backdropUrl);
  const late = useLateReveal(backdropUrl && !broken ? backdropUrl : null);
  const native = useLiquidGlassMode() === "native";
  // La couleur moyenne du décor (un épisode prend celle que sa série lui prête, s'il en a une).
  const tone = itemImageColor(item, "Backdrop");

  return (
    <section className={`relative flex w-full flex-col justify-end ${DETAIL_STAGE_MIN_H}`} aria-label={item.Name}>
      {/* `detail-stage-box` : marqueur de la boîte image (sans style). */}
      <div ref={boxRef} className={`detail-stage-box pointer-events-none absolute inset-x-0 top-0 overflow-hidden ${DETAIL_STAGE_BOX}`}>
        {backdropUrl && !broken && (
          // La couleur de l'image dessous ; l'image fond dessus si elle arrive après l'entrée.
          // `instant` n'a plus rien à couper : aucune mise en place ne se joue.
          <div className="absolute inset-0" style={tone ? { backgroundColor: tone } : undefined} data-detail-instant={instant || undefined}>
            <div className="absolute inset-0" style={late.style}>
              <img
                src={backdropUrl}
                alt=""
                draggable={false}
                data-detail-art="backdrop"
                className="absolute inset-0 h-full w-full object-cover"
                style={{ objectPosition: DETAIL_STAGE_FOCUS }}
                onLoad={late.onLoad}
                onError={() => { late.onError(); reportFailure(); }}
              />
            </div>
          </div>
        )}
        {/* Pas de décor (titre sans images, ou image en échec) : le repli de
            marque, jamais un aplat vide. */}
        {(!backdropUrl || broken) && <DetailStageFallback />}
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
        {native ? (
          <StageButton onClick={onBack ?? (() => navigate(-1))} label={backLabel ?? t("common:back")} icon={<ArrowLeftIcon />} showLabel />
        ) : (
          // Le Retour du socle : il revient d'où l'on vient, et mène à l'accueil si la fiche a
          // été ouverte par un lien (rien derrière).
          <BackButton onMedia label={backLabel ?? t("common:back")} onBack={onBack} />
        )}
        {onOpenImages && (
          <StageButton onClick={onOpenImages} label={t("media:detailViewImages")} icon={<CornersOutIcon size={20} aria-hidden />} />
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
  // Verre natif : un rond (ou une capsule avec libellé) de verre clair, glyphes adaptés au
  // décor. Ailleurs : la pilule sur image du socle — la primitive retire `fallbackClassName`
  // en natif et garde la mise en page.
  return (
    <GlassButton
      onClick={onClick}
      aria-label={label}
      title={label}
      appearance={{ material: showLabel ? "pane" : "bead", tone: "dark", level: "clear", shape: showLabel ? "capsule" : "circle" }}
      className={showLabel ? "flex h-10 items-center gap-2 px-4 text-sm font-semibold" : "flex h-10 w-10 items-center justify-center"}
      fallbackClassName={showLabel ? "btn btn-on-media" : "icon-btn btn-on-media"}
    >
      {icon}
      {showLabel && <span>{label}</span>}
    </GlassButton>
  );
}
