import { Modal, View, Text, Pressable, ScrollView } from "react-native";
import { X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { MobileEpisodeList } from "../MobileEpisodeList";
import { PLAYER, spacing, FONT_FAMILY, SHEET_MAX_WIDTH } from "@/theme";

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
 *
 * L'app est verrouillée en portrait : seul ce Modal s'affiche en paysage. Le
 * `SafeAreaProvider` racine de l'app reste donc en marges portrait (left=0). On
 * imbrique un `SafeAreaProvider` DANS le Modal pour re-mesurer les marges dans
 * l'orientation réelle (paysage), et `SafeAreaView` écarte le contenu de
 * l'encoche/caméra latérale sans rétrécir le fond.
 */
export function PlayerEpisodePicker({ visible, seriesId, currentEpisodeId, initialSeasonId, onClose }: Props) {
  const router = useRouter();
  const { t } = useTranslation("common");

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} supportedOrientations={["portrait", "landscape"]}>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: PLAYER.controlBg }}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={t("close")} />
          <SafeAreaView
            edges={["left", "right", "bottom"]}
            style={{ maxHeight: "78%", width: "100%", maxWidth: SHEET_MAX_WIDTH, alignSelf: "center", backgroundColor: PLAYER.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderTopWidth: 1, borderColor: PLAYER.borderSubtle }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.screenPadding, paddingTop: 16, paddingBottom: 8 }}>
              <Text style={{ fontSize: 18, fontFamily: FONT_FAMILY.bold, color: PLAYER.text }}>{t("seasonsEpisodes")}</Text>
              <Pressable onPress={onClose} hitSlop={12} style={{ padding: 4 }}>
                <X size={22} color={PLAYER.text} />
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
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}
