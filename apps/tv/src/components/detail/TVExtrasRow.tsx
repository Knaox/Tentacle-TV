import { memo, useCallback, useState } from "react";
import { View, Text, Image } from "react-native";
import { useTranslation } from "react-i18next";
import { parseYouTubeId, type RichTrailer } from "@tentacle-tv/shared";
import { FocusableRow } from "../focus/FocusableRow";
import { Colors, Typography, Radius } from "../../theme/colors";

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
 *
 * Comme le web : on MASQUE les trailers indisponibles/privés. YouTube renvoie un
 * placeholder gris 120×90 sur `hqdefault.jpg` pour ces vidéos → on le détecte via
 * les dimensions au chargement de la vignette (`onLoad`) et on retire l'entrée.
 */
export const TVExtrasRow = memo(function TVExtrasRow({ trailers, onSelect, style }: TVExtrasRowProps) {
  const { t } = useTranslation("common");
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());

  const markUnavailable = useCallback((url: string) => {
    setUnavailable((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  const visible = trailers.filter((tr) => !unavailable.has(tr.Url));
  if (visible.length === 0) return null;

  return (
    <FocusableRow
      title={t("extras", { defaultValue: "Extras" })}
      data={visible}
      renderItem={(tr: RichTrailer) => (
        <ExtraTile
          trailer={tr}
          fallbackLabel={t("trailer", { defaultValue: "Bande-annonce" })}
          onUnavailable={() => markUnavailable(tr.Url)}
        />
      )}
      keyExtractor={(tr) => tr.Url}
      itemWidth={TILE_W}
      style={style}
      onItemPress={onSelect}
    />
  );
});

function ExtraTile({
  trailer,
  fallbackLabel,
  onUnavailable,
}: {
  trailer: RichTrailer;
  fallbackLabel: string;
  onUnavailable: () => void;
}) {
  const ytId = parseYouTubeId(trailer.Url);
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
            // Vidéo supprimée/privée → placeholder 120×90 : on masque l'entrée.
            onLoad={(e) => {
              const w = e.nativeEvent?.source?.width;
              if (w && w <= 120) onUnavailable();
            }}
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
