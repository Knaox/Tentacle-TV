import { View, Text, Image } from "react-native";
import { useJellyfinClient } from "@tentacle/api-client";
import type { MediaItem } from "@tentacle/shared";
import { ticksToSeconds } from "@tentacle/shared";
import { useTranslation } from "react-i18next";
import { Colors, Typography, Radius, CardConfig } from "../theme/colors";
import { CheckIcon } from "./icons/TVIcons";

interface TVMediaCardProps {
  item: MediaItem;
  variant?: "portrait" | "landscape";
  width?: number;
}

export function TVMediaCard({ item, variant = "portrait", width }: TVMediaCardProps) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const progress = item.UserData?.PlayedPercentage ?? 0;
  const isWatched = item.UserData?.Played === true;

  if (variant === "landscape") {
    return (
      <LandscapeCard
        item={item} client={client} width={width}
        progress={progress} isWatched={isWatched}
      />
    );
  }
  return (
    <PortraitCard
      item={item} client={client} width={width}
      progress={progress} isWatched={isWatched} t={t}
    />
  );
}

interface CardInnerProps {
  item: MediaItem;
  client: ReturnType<typeof useJellyfinClient>;
  width?: number;
  progress: number;
  isWatched: boolean;
}

function PortraitCard({ item, client, width: w, progress, isWatched, t }: CardInnerProps & { t: ReturnType<typeof useTranslation>["t"] }) {
  const cardW = w ?? CardConfig.portrait.width;
  const cardH = cardW / CardConfig.portrait.aspectRatio;
  const poster = client.getImageUrl(item.Id, "Primary", { height: 500, quality: 90 });

  return (
    <View style={{ width: cardW }}>
      <View style={{ borderRadius: Radius.card, overflow: "hidden", backgroundColor: Colors.bgCard }}>
        <Image
          source={{ uri: poster }}
          style={{ width: cardW, height: cardH, backgroundColor: Colors.bgElevated }}
          resizeMode="cover"
        />
        {progress > 0 && !isWatched && (
          <View style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            height: CardConfig.progressBarHeight, backgroundColor: "rgba(0,0,0,0.5)",
          }}>
            <View style={{
              height: CardConfig.progressBarHeight,
              width: `${Math.min(progress, 100)}%`,
              backgroundColor: Colors.progressOrange, borderRadius: 2,
            }} />
          </View>
        )}
        {isWatched && (
          <View style={{
            position: "absolute", top: 8, right: 8,
            width: 18, height: 18, borderRadius: 9,
            backgroundColor: Colors.success,
            justifyContent: "center", alignItems: "center",
          }}>
            <CheckIcon size={10} color={Colors.textPrimary} />
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={{ color: Colors.textSecondary, ...Typography.cardTitle, marginTop: 10 }}>
        {item.Name}
      </Text>
      <Text style={{ color: Colors.textTertiary, ...Typography.meta, marginTop: 2 }}>
        {item.ProductionYear ?? ""}{" "}
        {item.Type === "Movie" ? t("movie") : item.Type === "Series" ? t("series") : ""}
      </Text>
    </View>
  );
}

function LandscapeCard({ item, client, width: w, progress, isWatched }: CardInnerProps) {
  const cardW = w ?? CardConfig.landscape.width;
  const cardH = cardW / CardConfig.landscape.aspectRatio;
  const imageType = item.Type === "Episode" ? "Primary" : "Backdrop";
  const thumb = client.getImageUrl(item.Id, imageType, { width: 640, quality: 85 });

  const episodeLabel = item.Type === "Episode" && item.ParentIndexNumber != null && item.IndexNumber != null
    ? `S${String(item.ParentIndexNumber).padStart(2, "0")}E${String(item.IndexNumber).padStart(2, "0")}`
    : null;

  const remainingTicks = item.RunTimeTicks && progress > 0
    ? item.RunTimeTicks * (1 - progress / 100)
    : null;
  const remainingMin = remainingTicks ? Math.round(ticksToSeconds(remainingTicks) / 60) : null;

  return (
    <View style={{ width: cardW }}>
      <View style={{ borderRadius: Radius.card, overflow: "hidden", backgroundColor: Colors.bgCard }}>
        <Image
          source={{ uri: thumb }}
          style={{ width: cardW, height: cardH, backgroundColor: Colors.bgElevated }}
          resizeMode="cover"
        />
        {/* Bottom gradient for text legibility */}
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: cardH * 0.5,
        }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.05)" }} />
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)" }} />
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)" }} />
        </View>
        {/* Episode info overlay */}
        <View style={{ position: "absolute", bottom: CardConfig.progressBarHeight + 10, left: 12, right: 50 }}>
          {episodeLabel ? (
            <Text numberOfLines={1} style={{ color: Colors.accentPurpleLight, fontSize: 13, fontWeight: "600" }}>
              {episodeLabel}{item.Name ? ` · ${item.Name}` : ""}
            </Text>
          ) : (
            <Text numberOfLines={1} style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: "600" }}>
              {item.Name}
            </Text>
          )}
        </View>
        {/* Remaining time */}
        {remainingMin != null && remainingMin > 0 && (
          <View style={{ position: "absolute", bottom: CardConfig.progressBarHeight + 10, right: 12 }}>
            <Text style={{ color: Colors.textMuted, fontSize: 11 }}>{remainingMin} min</Text>
          </View>
        )}
        {/* Progress bar */}
        {progress > 0 && (
          <View style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            height: CardConfig.progressBarHeight, backgroundColor: "rgba(0,0,0,0.5)",
          }}>
            <View style={{
              height: CardConfig.progressBarHeight,
              width: `${Math.min(progress, 100)}%`,
              backgroundColor: Colors.progressOrange, borderRadius: 2,
            }} />
          </View>
        )}
        {isWatched && (
          <View style={{
            position: "absolute", top: 8, right: 8,
            width: 18, height: 18, borderRadius: 9,
            backgroundColor: Colors.success,
            justifyContent: "center", alignItems: "center",
          }}>
            <CheckIcon size={10} color={Colors.textPrimary} />
          </View>
        )}
      </View>
      {item.SeriesName && (
        <Text numberOfLines={1} style={{ color: Colors.textTertiary, ...Typography.caption, marginTop: 8 }}>
          {item.SeriesName}
        </Text>
      )}
    </View>
  );
}
