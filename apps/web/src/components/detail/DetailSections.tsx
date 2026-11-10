import { createContext, useContext, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import type { MediaItem } from "@tentacle-tv/shared";
import { CastRow } from "../CastRow";
import { EpisodeList } from "../EpisodeList";
import { MediaRow } from "../rows/MediaRow";
import { RowHeader } from "../rows/RowHeader";
import { LicenseAttribution } from "../media/LicenseAttribution";
import { ExtrasSection } from "./ExtrasSection";
import { SagaSection } from "./saga/SagaSection";
import { IncludedInRow } from "./IncludedInRow";
import { DetailFacts } from "./DetailFacts";
import { TechInfo } from "../TechInfo";
import { DETAIL_COLLECTION_ANCHOR } from "./detailStageGeometry";
import { duration, easeOut } from "../../theme/motion";

interface DetailSectionsProps {
  item: MediaItem;
  parentSeries?: MediaItem;
  collectionItems?: MediaItem[];
  similar?: MediaItem[];
  episodeListSeriesId?: string;
  highlightEpisodeId?: string;
  highlightSeasonId?: string;
  /** La saison où ouvrir la liste d'une série (carte regroupée des « Derniers ajouts »). */
  openSeasonId?: string;
}

/**
 * Tout ce qui suit le bloc titre de la fiche, dans l'ordre de lecture :
 * contenu de la collection → extras → saisons et épisodes → casting et équipe
 * → informations (et infos techniques) → saga du film → titres similaires →
 * licence.
 *
 * Les infos techniques ont quitté la scène : sur le premier écran, elles
 * repoussaient « Lecture » sous un panneau que presque personne n'ouvre.
 *
 * Les extras restent AU-DESSUS des épisodes (décision antérieure, gardée).
 * Chaque section entre en fondu une seule fois, à son arrivée dans le champ —
 * et plus du tout sur une fiche déjà parcourue pendant la séance (`Reveal`).
 */
export function DetailSections({
  item, parentSeries, collectionItems, similar, episodeListSeriesId, highlightEpisodeId, highlightSeasonId, openSeasonId,
}: DetailSectionsProps) {
  const { t } = useTranslation("common");
  const isEpisode = item.Type === "Episode";
  const isSeries = item.Type === "Series";
  const streams = item.MediaSources?.[0]?.MediaStreams ?? [];

  return (
    <RevealItem.Provider value={item.Id}>
    <div className="relative z-10 mt-6 space-y-12 pb-16">
      {/* Collection (BoxSet) : contenu navigable — un BoxSet n'a ni lecture
          ni saisons, sa fiche restait vide. */}
      {item.Type === "BoxSet" && collectionItems && collectionItems.length > 0 && (
        // Une rangée joue sa propre entrée (`rowEntrance`) : pas de fondu en
        // plus. Marge de défilement : l'ancre ne se colle pas au bord haut.
        <div id={DETAIL_COLLECTION_ANCHOR} className="scroll-mt-8">
          <MediaRow title={t("common:collectionContent", { defaultValue: "Contenu de la collection" })} items={collectionItems} />
        </div>
      )}

      {/* Épisode : la série parente prête ses extras en repli. */}
      <ExtrasSection item={item} seriesItem={isEpisode ? parentSeries : undefined} />

      {episodeListSeriesId && (
        <Reveal as="section">
          <div className="group/row"><RowHeader title={t("common:seasonsEpisodes")} /></div>
          <EpisodeList
            seriesId={episodeListSeriesId}
            currentEpisodeId={highlightEpisodeId}
            initialSeasonId={highlightSeasonId}
            openSeasonId={openSeasonId}
            seriesItem={isSeries ? item : parentSeries}
            followResume={isSeries}
          />
        </Reveal>
      )}

      {item.People && item.People.length > 0 && (
        <Reveal>
          <CastRow people={item.People} />
        </Reveal>
      )}

      <Reveal>
        <DetailFacts item={item} />
        {streams.length > 0 && (
          <div className="row-gutter">
            <TechInfo streams={streams} />
          </div>
        )}
      </Reveal>

      {/* La saga d'un film (collection TMDB), comme dans Vigie : juste avant
          les similaires, la même famille de titres liés. */}
      {item.Type === "Movie" && <SagaSection item={item} />}

      {/* Les collections de la bibliothèque qui le contiennent (Jellyfin 12+). */}
      {item.Type !== "BoxSet" && <IncludedInRow itemId={item.Id} />}

      {similar && similar.length > 0 && (
        <MediaRow title={t("common:similarTitles")} items={similar} />
      )}

      <LicenseAttribution item={item} />
    </div>
    </RevealItem.Provider>
  );
}

/** La fiche dont les sections se révèlent : leur mémoire est par titre. */
const RevealItem = createContext<string | null>(null);

/**
 * Les fiches dont une section s'est déjà révélée pendant la séance : y revenir
 * (retour du lecteur, d'une personne) ne rejoue aucun fondu — même règle que
 * les images déjà vues. Bornée : au-delà, les plus anciennes repartent de zéro.
 */
const revealed = new Set<string>();
const REVEALED_MAX = 200;

function markRevealed(itemId: string | null): void {
  if (itemId === null || revealed.has(itemId)) return;
  if (revealed.size >= REVEALED_MAX) revealed.delete(revealed.values().next().value as string);
  revealed.add(itemId);
}

const REVEAL_VIEWPORT = { once: true, margin: "-50px" } as const;
const REVEAL_FROM = { opacity: 0 } as const;
const REVEAL_TO = { opacity: 1 } as const;
// 220 ms, l'opacité seule : c'est le fondu d'une image (`--duration-card`), pas une entrée de page.
const REVEAL_TRANSITION = { duration: duration.card, ease: easeOut } as const;

function Reveal({ children, as = "div" }: { children: ReactNode; as?: "div" | "section" }) {
  const Tag = as === "section" ? motion.section : motion.div;
  const itemId = useContext(RevealItem);
  const reduced = useReducedMotion();
  // Lu au rendu : la section d'une fiche déjà parcourue, ou sous mouvement réduit, est là d'emblée.
  const instant = reduced === true || (itemId !== null && revealed.has(itemId));
  return (
    <Tag
      initial={instant ? false : REVEAL_FROM}
      whileInView={REVEAL_TO}
      viewport={REVEAL_VIEWPORT}
      transition={REVEAL_TRANSITION}
      onViewportEnter={() => markRevealed(itemId)}
    >
      {children}
    </Tag>
  );
}
