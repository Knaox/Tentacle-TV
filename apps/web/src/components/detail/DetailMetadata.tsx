import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { formatDuration } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import type { MediaStream } from "@tentacle-tv/shared";
import { StarIcon, QualityBadge } from "../media/MediaDetailIcons";

interface DetailMetadataProps {
  item: MediaItem;
  streams: MediaStream[];
}

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };

/**
 * Year / rating / runtime / season info / quality badges / genres.
 * Pure presentation; no mutations or navigation.
 */
export function DetailMetadata({ item, streams }: DetailMetadataProps) {
  const { t } = useTranslation("common");
  const isSeries = item.Type === "Series";
  const runtime = formatDuration(item.RunTimeTicks);

  const videoStream = streams.find((s) => s.Type === "Video");
  const audioStream = streams.find((s) => s.Type === "Audio");
  const is4K = videoStream && videoStream.Width != null && videoStream.Width >= 3840;
  const isHDR = videoStream?.VideoRangeType != null && videoStream.VideoRangeType !== "SDR";
  const audioChannels = audioStream?.Channels ?? 0;
  const audioLabel = audioChannels >= 8 ? "7.1" : audioChannels >= 6 ? "5.1" : null;
  const isAtmos = audioStream?.Codec != null &&
    (audioStream.Codec.includes("truehd") || audioStream.Codec.includes("eac3"));

  return (
    <>
      <motion.div
        variants={fadeUp}
        className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-white/70"
      >
        {item.ProductionYear && <span className="font-medium">{item.ProductionYear}</span>}
        {item.OfficialRating && (
          <span className="rounded border border-white/30 px-1.5 py-0.5 text-[10px] font-bold tracking-wider">
            {item.OfficialRating}
          </span>
        )}
        {item.CommunityRating && (
          <span className="flex items-center gap-1 font-medium">
            <StarIcon /> {item.CommunityRating.toFixed(1)}
          </span>
        )}
        {runtime && <span>{runtime}</span>}
        {isSeries && item.ChildCount != null && (
          <span>{item.ChildCount} {t("common:seasons")}</span>
        )}
        {isSeries && item.Status && (
          <span className="rounded bg-white/10 px-2 py-0.5 text-[11px]">
            {item.Status === "Continuing" ? t("common:ongoing") : t("common:ended")}
          </span>
        )}
        {is4K && <QualityBadge label="4K" />}
        {isHDR && <QualityBadge label="HDR" />}
        {audioLabel && <QualityBadge label={audioLabel} />}
        {isAtmos && <QualityBadge label="Atmos" />}
      </motion.div>

      {item.Genres && item.Genres.length > 0 && (
        <motion.div variants={fadeUp} className="mt-3 flex flex-wrap gap-2">
          {item.Genres.map((g) => (
            <span
              key={g}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65"
            >
              {g}
            </span>
          ))}
        </motion.div>
      )}
    </>
  );
}
