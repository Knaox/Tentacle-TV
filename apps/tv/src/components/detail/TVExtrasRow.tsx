import { memo, useCallback, useState } from "react";
import { View, Text, Image, type LayoutChangeEvent } from "react-native";
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
  /** Position de la rangée dans la page — pour le défilement d'accompagnement. */
  onLayout?: (event: LayoutChangeEvent) => void;
  /** Une tuile de la rangée a le focus — la page s'ancre sur la rangée. */
  onRowFocus?: () => void;
  /** HAUT depuis une tuile → ce focusable (le bouton Lecture) : l'ancrage de
   *  page fait sortir les actions de l'écran, la cible géométrique disparaît. */
  tilesNextFocusUp?: number;
}

/**
 * Rangée « Extras » de la fiche média — équivalent TV de l'ExtrasRow web :
 * tuiles 16:9 avec miniature YouTube, libellé + type, lecture in-app au clic.
 *
 * Trailers indisponibles/privés : YouTube renvoie un placeholder gris 120×90
 * sur `hqdefault.jpg` → détecté via les dimensions au chargement (`onLoad`).
 * La LG les MASQUE (pointer libre) ; ici on les GRISE sans les démonter : la
 * vignette se résout pendant qu'on parcourt la rangée, et démonter la tuile
 * FOCUSÉE laissait le focus orphelin — plus aucune flèche ne répondait.
 */
export const TVExtrasRow = memo(function TVExtrasRow({ trailers, onSelect, style, onLayout, onRowFocus, tilesNextFocusUp }: TVExtrasRowProps) {
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

  const handleSelect = useCallback((tr: RichTrailer) => {
    if (!unavailable.has(tr.Url)) onSelect(tr);
  }, [unavailable, onSelect]);

  if (trailers.length === 0) return null;

  return (
    <FocusableRow
      title={t("extras")}
      data={trailers}
      renderItem={(tr: RichTrailer) => (
        <ExtraTile
          trailer={tr}
          fallbackLabel={t("trailer")}
          unavailableLabel={t("trailerUnavailableShort")}
          unavailable={unavailable.has(tr.Url)}
          onUnavailable={() => markUnavailable(tr.Url)}
        />
      )}
      keyExtractor={(tr) => tr.Url}
      itemWidth={TILE_W}
      style={style}
      onItemPress={handleSelect}
      onLayout={onLayout}
      onRowFocus={onRowFocus}
      cellNextFocusUp={tilesNextFocusUp}
    />
  );
});

function ExtraTile({
  trailer,
  fallbackLabel,
  unavailableLabel,
  unavailable,
  onUnavailable,
}: {
  trailer: RichTrailer;
  fallbackLabel: string;
  unavailableLabel: string;
  unavailable: boolean;
  onUnavailable: () => void;
}) {
  const ytId = parseYouTubeId(trailer.Url);
  const [imgFailed, setImgFailed] = useState(false);
  const thumb = ytId && !imgFailed ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : null;

  return (
    <View style={{ width: TILE_W, opacity: unavailable ? 0.35 : 1 }}>
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
        {unavailable ? unavailableLabel : trailer.type || "YouTube"}
      </Text>
    </View>
  );
}
