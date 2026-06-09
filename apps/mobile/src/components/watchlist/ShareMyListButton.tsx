import { useState } from "react";
import { Pressable, Text, StyleSheet, Share } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useCreateShareLink } from "@tentacle-tv/api-client";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { typography, BRAND, BORDER, FONT_FAMILY, colors } from "@/theme";

/**
 * « Partager ma liste » (mobile) — génère le lien de partage et ouvre la
 * feuille de partage native. Le lien ouvre la page web /share/:token.
 */
export function ShareMyListButton() {
  const { t } = useTranslation("common");
  const { serverUrl } = useServerUrl();
  const create = useCreateShareLink();
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { token } = await create.mutateAsync();
      const url = `${(serverUrl ?? "").replace(/\/$/, "")}/share/${token}`;
      await Share.share({ message: url, url });
    } catch {
      /* annulé / hors-ligne */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={t("shareMyList")}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}
    >
      <Feather name="share-2" size={15} color={BRAND.light} />
      <Text style={styles.label}>{t("shareMyList")}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER.subtle,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  label: {
    ...typography.caption,
    fontFamily: FONT_FAMILY.semibold,
    color: colors.textPrimary,
  },
});
