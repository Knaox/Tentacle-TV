import { Modal, View, Text, Pressable, ScrollView } from "react-native";
import { X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MobileEpisodeList } from "../MobileEpisodeList";
import { SURFACE, spacing, FONT_FAMILY, BORDER, colors } from "@/theme";

interface Props {
  visible: boolean;
  seriesId: string;
  currentEpisodeId?: string;
  initialSeasonId?: string;
  onClose: () => void;
}

/**
 * Sélecteur saison/épisode dans le lecteur — modal bas réutilisant
 * MobileEpisodeList. Choisir un épisode relance le lecteur dessus.
 */
export function PlayerEpisodePicker({ visible, seriesId, currentEpisodeId, initialSeasonId, onClose }: Props) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} supportedOrientations={["portrait", "landscape"]}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={t("close")} />
        <View style={{ maxHeight: "78%", backgroundColor: SURFACE.s1, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingBottom: insets.bottom + 8, borderTopWidth: 1, borderColor: BORDER.subtle }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.screenPadding, paddingTop: 16, paddingBottom: 8 }}>
            <Text style={{ fontSize: 18, fontFamily: FONT_FAMILY.bold, color: colors.textPrimary }}>{t("seasonsEpisodes")}</Text>
            <Pressable onPress={onClose} hitSlop={12} style={{ padding: 4 }}>
              <X size={22} color="#fff" />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
            <MobileEpisodeList
              seriesId={seriesId}
              currentEpisodeId={currentEpisodeId}
              initialSeasonId={initialSeasonId}
              onPlay={(ep) => { onClose(); router.replace(`/watch/${ep.Id}`); }}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
