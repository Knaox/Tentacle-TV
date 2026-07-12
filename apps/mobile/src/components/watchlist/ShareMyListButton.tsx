import { useState, useRef } from "react";
import { Pressable, Text, StyleSheet, Share, Platform, View, findNodeHandle } from "react-native";
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
  const btnRef = useRef<View>(null);

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { token } = await create.mutateAsync();
      const base = (serverUrl ?? "").replace(/\/$/, "");
      const url = `${base}/share/${token}`;
      // iOS exige une URL absolue valide, sinon la conversion NSURL échoue et la
      // feuille de partage ne s'affiche pas (silencieux) — surtout sur appareil
      // physique, plus strict que le simulateur.
      if (!/^https?:\/\//.test(url)) {
        throw new Error(`URL de partage invalide: ${url}`);
      }
      // Sur iOS, ne passer QUE `url` (le message dupliqué casse l'aperçu / la
      // présentation de la feuille). Android préfère `message`. Sur iPad la
      // feuille est un popover → l'ancrer sur le bouton source.
      const anchor = Platform.OS === "ios" ? (findNodeHandle(btnRef.current) ?? undefined) : undefined;
      await Share.share(
        Platform.OS === "ios" ? { url } : { message: url },
        anchor != null ? { anchor } : undefined,
      );
    } catch (e) {
      // L'utilisateur a peut-être juste annulé ; on logue pour diagnostiquer les
      // échecs réels (URL invalide, hors-ligne) au lieu de les masquer.
      if (__DEV__) console.warn("[ShareMyList] partage échoué", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      ref={btnRef}
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
