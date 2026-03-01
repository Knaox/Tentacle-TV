import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import type { SeerrSearchResult } from "@tentacle-tv/api-client";

const TMDB_IMG = "https://image.tmdb.org/t/p";

const STATUS_STYLES: Record<number, { key: string; bg: string; text: string }> = {
  2: { key: "requests:statusRequested", bg: "rgba(234,179,8,0.15)", text: "#eab308" },
  3: { key: "requests:downloadInProgress", bg: "rgba(59,130,246,0.15)", text: "#3b82f6" },
  4: { key: "requests:downloadPartial", bg: "rgba(249,115,22,0.15)", text: "#f97316" },
  5: { key: "requests:statusAvailable", bg: "rgba(34,197,94,0.15)", text: "#22c55e" },
};

interface Props {
  item: SeerrSearchResult;
  onRequest: (body: { mediaType: "movie" | "tv"; mediaId: number }) => void;
}

export function MobileSeerrCard({ item, onRequest }: Props) {
  const { t } = useTranslation("requests");
  const title = item.title || item.name || "";
  const year = (item.releaseDate || item.firstAirDate || "").slice(0, 4);
  const poster = item.posterPath ? `${TMDB_IMG}/w300${item.posterPath}` : null;
  const status = item.mediaInfo?.status;
  const statusInfo = status ? STATUS_STYLES[status] : null;
  const isRequested = status != null && status >= 2;

  return (
    <View style={{ borderRadius: 10, overflow: "hidden", backgroundColor: "#12121a" }}>
      <View style={{ aspectRatio: 2 / 3, backgroundColor: "#1e1e2e" }}>
        {poster ? (
          <Image source={{ uri: poster }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        ) : (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>{title}</Text>
          </View>
        )}
        {status === 5 && (
          <View style={{ position: "absolute", top: 6, right: 6, backgroundColor: "rgba(34,197,94,0.9)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600" }}>{t("requests:statusAvailable")}</Text>
          </View>
        )}
      </View>
      <View style={{ padding: 8 }}>
        <Text numberOfLines={1} style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>{title}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
          {year ? <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{year}</Text> : null}
          <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>
            {item.mediaType === "movie" ? t("common:movie") : t("common:series")}
          </Text>
        </View>
        {statusInfo ? (
          <View style={{ marginTop: 6, backgroundColor: statusInfo.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start" }}>
            <Text style={{ color: statusInfo.text, fontSize: 11, fontWeight: "600" }}>{t(statusInfo.key)}</Text>
          </View>
        ) : (
          <Pressable
            onPress={() => { if (!isRequested) onRequest({ mediaType: item.mediaType as "movie" | "tv", mediaId: item.id }); }}
            style={{ marginTop: 6, backgroundColor: "#8b5cf6", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, alignSelf: "flex-start" }}
          >
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>{t("requests:makeRequest")}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
