import { Pressable, View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { BrandSpinner } from "../ui";
import { PLAYER } from "@/theme";

interface Props {
  title?: string;
  /**
   * Quitter sans attendre le démarrage.
   *
   * L'écran occupe tout l'appareil AVANT que le lecteur et ses contrôles
   * existent : il n'y a là ni bouton Retour, ni geste de fermeture, et une
   * ouverture qui traîne — serveur lent, transcodage qui démarre — enferme
   * devant un rond qui tourne. Absent quand la vue sert de simple voile de
   * mise en mémoire tampon EN COURS de lecture : les contrôles sont déjà là.
   */
  onCancel?: () => void;
}

export function PlayerLoadingView({ title, onCancel }: Props) {
  const { t } = useTranslation("player");
  const insets = useSafeAreaInsets();

  return (
    <View style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      justifyContent: "center", alignItems: "center", backgroundColor: PLAYER.scrimSoft,
    }}>
      {onCancel && (
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={t("back")}
          hitSlop={8}
          style={({ pressed }) => [{
            position: "absolute", left: 16, top: insets.top + 12,
            minHeight: 44, paddingHorizontal: 22, justifyContent: "center",
            borderRadius: 9999, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.25)",
            backgroundColor: "rgba(0, 0, 0, 0.45)",
          }, pressed && { opacity: 0.7 }]}
        >
          <Text style={{ color: "rgba(255, 255, 255, 0.85)", fontSize: 14, fontWeight: "600" }}>
            {t("back")}
          </Text>
        </Pressable>
      )}
      <BrandSpinner size="large" colors={[PLAYER.accent, PLAYER.accentRose]} />
      {title && (
        <Text style={{ color: PLAYER.textTertiary, fontSize: 13, marginTop: 12 }}>
          {title}
        </Text>
      )}
    </View>
  );
}
