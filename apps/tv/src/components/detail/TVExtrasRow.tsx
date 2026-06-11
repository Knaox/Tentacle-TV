import { memo, useState } from "react";
import { View, Text, Image } from "react-native";
import { useTranslation } from "react-i18next";
import { parseYouTubeId, type RichTrailer } from "@tentacle-tv/shared";
import { FocusableRow } from "../focus/FocusableRow";
import { Colors, Typography, Radius, Spacing } from "../../theme/colors";

const TILE_W = 280;
const TILE_H = Math.round(TILE_W * 9 / 16);

interface TVExtrasRowProps {
  trailers: RichTrailer[];
  onSelect: (trailer: RichTrailer) => void;
  style?: object;
}

/**
 * Rangée « Extras » de la fiche média — équivalent TV de l'ExtrasRow web :
 * tuiles 16:9 avec miniature YouTube, libellé + type, lecture in-app au clic.
 */
export const TVExtrasRow = memo(function TVExtrasRow({ trailers, onSelect, style }: TVExtrasRowProps) {
  const { t } = useTranslation("common");
  if (trailers.length === 0) return null;

  return (
    <FocusableRow
      title={t("extras", { defaultValue: "Extras" })}
      data={trailers}
      renderItem={(tr: RichTrailer) => <ExtraTile trailer={tr} fallbackLabel={t("trailer", { defaultValue: "Bande-annonce" })} />}
      keyExtractor={(tr) => tr.Url}
      itemWidth={TILE_W}
      style={style}
      onItemPress={onSelect}
    />
  );
});

function ExtraTile({ trailer, fallbackLabel }: { trailer: RichTrailer; fallbackLabel: string }) {
  const ytId = parseYouTubeId(trailer.Url);
  // Miniature YouTube ; les vidéos supprimées renvoient un placeholder gris
  // 120x90 — pas détectable via naturalWidth en RN, on garde la tuile.
  const [imgFailed, setImgFailed] = useState(false);
  const thumb = ytId && !imgFailed ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : null;

  return (
    <View style={{ width: TILE_W }}>
      <View style={{
        width: TILE_W, height: TILE_H,
        borderRadius: Radius.card,
        backgroundColor: Colors.bgCard,
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
      }}>
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <Text style={{ color: Colors.textMuted, fontSize: 30 }}>▶</Text>
        )}
      </View>
      <Text
        numberOfLines={1}
        style={{ color: Colors.textSecondary, ...Typography.cardTitle, marginTop: 8, width: TILE_W }}
      >
        {trailer.Name || fallbackLabel}
      </Text>
      <Text numberOfLines={1} style={{ color: Colors.textMuted, ...Typography.caption, width: TILE_W }}>
        {trailer.type || "YouTube"}
      </Text>
    </View>
  );
}
