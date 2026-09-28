import { memo, useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { DetailImageRef } from "@tentacle-tv/shared";
import { FONT_FAMILY } from "@/theme";

const KIND_KEY = { backdrop: "imageKindBackdrop", poster: "imageKindPoster", still: "imageKindStill" } as const;

interface Props {
  title: string;
  gallery: DetailImageRef[];
  /** Image ouverte ; `null` = fermée. */
  index: number | null;
  onClose: () => void;
}

/**
 * La vue « image plein écran » de la fiche : décors, affiche, image d'un
 * épisode, en entier (`contain`) sur un noir presque plein. On passe d'une
 * image à l'autre au doigt (pages horizontales), le retour Android et le
 * bouton ferment. Jumeau de `DetailImageViewer` du web ; aucun flou, aucune
 * animation continue — le fondu d'entrée est celui de la modale.
 */
export const DetailImageViewer = memo(function DetailImageViewer({ title, gallery, index, onClose }: Props) {
  const { t } = useTranslation("media");
  const client = useJellyfinClient();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<DetailImageRef>>(null);
  const open = index !== null && gallery.length > 0;
  const [current, setCurrent] = useState(index ?? 0);

  // Chaque ouverture repart de l'image demandée.
  useEffect(() => {
    if (index !== null) setCurrent(index);
  }, [index]);

  const onMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setCurrent(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)));
  }, [width]);

  if (!open) return null;
  const ref = gallery[Math.min(current, gallery.length - 1)];

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent supportedOrientations={["portrait", "landscape"]} onRequestClose={onClose}>
      <View style={st.root} accessibilityViewIsModal accessibilityLabel={t("imageViewerTitle", { title })}>
        <FlatList
          ref={listRef}
          data={gallery}
          keyExtractor={(g) => g.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={index ?? 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={onMomentumEnd}
          renderItem={({ item: g }) => (
            <View style={{ width, height, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 }}>
              <Image
                source={{ uri: client.getImageUrl(g.itemId, g.imageType, { ...(g.aspect >= 1 ? { width: 2048 } : { height: 1600 }), quality: 92, tag: g.tag, index: g.index }) }}
                style={{ width: "100%", height: height - insets.top - insets.bottom - 120, borderRadius: 12 }}
                contentFit="contain"
                transition={200}
                accessibilityLabel={`${title} — ${t(KIND_KEY[g.kind])}`}
              />
            </View>
          )}
        />
        <View style={[st.header, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
          <View style={{ flex: 1 }}>
            <Text style={st.title} numberOfLines={1}>{title}</Text>
            <Text style={st.sub} accessibilityLiveRegion="polite">
              {t(KIND_KEY[ref.kind])}
              {gallery.length > 1 ? ` · ${t("imageViewerCounter", { index: current + 1, count: gallery.length })}` : ""}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("imageViewerClose")} style={st.close}>
            <Feather name="x" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        {gallery.length > 1 && (
          <View style={[st.dots, { bottom: insets.bottom + 20 }]} pointerEvents="none">
            {gallery.map((g, i) => (
              <View key={g.key} style={[st.dot, i === current && st.dotOn]} />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
});

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "rgba(4, 3, 8, 0.97)" },
  header: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 },
  title: { color: "#FFFFFF", fontSize: 16, fontFamily: FONT_FAMILY.semibold },
  sub: { color: "rgba(255, 255, 255, 0.6)", fontSize: 12, fontFamily: FONT_FAMILY.medium, marginTop: 2 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255, 255, 255, 0.12)", alignItems: "center", justifyContent: "center" },
  dots: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255, 255, 255, 0.3)" },
  dotOn: { width: 18, backgroundColor: "#FFFFFF" },
});
