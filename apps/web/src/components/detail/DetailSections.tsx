import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import type { MediaItem } from "@tentacle-tv/shared";
import { CastRow } from "../CastRow";
import { EpisodeList } from "../EpisodeList";
import { MediaRow } from "../rows/MediaRow";
import { RowHeader } from "../rows/RowHeader";
import { LicenseAttribution } from "../media/LicenseAttribution";
import { ExtrasSection } from "./ExtrasSection";
import { DetailFacts } from "./DetailFacts";
import { fadeIn } from "../../theme/motion";

interface DetailSectionsProps {
  item: MediaItem;
  parentSeries?: MediaItem;
  collectionItems?: MediaItem[];
  similar?: MediaItem[];
  episodeListSeriesId?: string;
  highlightEpisodeId?: string;
  highlightSeasonId?: string;
}

/**
 * Tout ce qui suit le bloc titre de la fiche, dans l'ordre de lecture :
 * contenu de la collection → extras → saisons et épisodes → casting et équipe
 * → informations → titres similaires → licence.
 *
 * Les extras restent AU-DESSUS des épisodes (décision antérieure, gardée).
 * Chaque section entre en fondu une seule fois, à son arrivée dans le champ.
 */
export function DetailSections({
  item, parentSeries, collectionItems, similar, episodeListSeriesId, highlightEpisodeId, highlightSeasonId,
}: DetailSectionsProps) {
  const { t } = useTranslation("common");
  const isEpisode = item.Type === "Episode";
  const isSeries = item.Type === "Series";

  return (
    <div className="mt-12 space-y-12 pb-16">
      {/* Collection (BoxSet) : contenu navigable — un BoxSet n'a ni lecture
          ni saisons, sa fiche restait vide. */}
      {item.Type === "BoxSet" && collectionItems && collectionItems.length > 0 && (
        <Reveal>
          <MediaRow title={t("common:collectionContent", { defaultValue: "Contenu de la collection" })} items={collectionItems} />
        </Reveal>
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
            seriesItem={isSeries ? item : parentSeries}
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
      </Reveal>

      {similar && similar.length > 0 && (
        <Reveal>
          <MediaRow title={t("common:similarTitles")} items={similar} />
        </Reveal>
      )}

      <LicenseAttribution item={item} />
    </div>
  );
}

function Reveal({ children, as = "div" }: { children: ReactNode; as?: "div" | "section" }) {
  const Tag = as === "section" ? motion.section : motion.div;
  return (
    <Tag
      variants={fadeIn}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
    >
      {children}
    </Tag>
  );
}
