import { useState, useRef } from "react";
import { Pressable, Text, StyleSheet, Share, Platform, View, findNodeHandle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useCreateShareLink, type ShareListKind } from "@tentacle-tv/api-client";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { typography, FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/**
 * « Partager ma liste » ou « Partager mes titres likés » (mobile) — génère le
 * lien de partage et ouvre la feuille de partage native. Le lien ouvre la page
 * web /share/:token, la même pour les deux listes.
 *
 * Pilule de 36 au ton de la marque (aplat `brand.soft`, liseré `brand.glow`,
 * icône et texte `brand.light`) : repérable sous le titre sans être l'action
 * principale — pas de dégradé plein.
 */
export function ShareMyListButton({ kind = "watchlist" }: { kind?: ShareListKind }) {
  const { t } = useTranslation("common");
  const label = t(kind === "likes" ? "shareMyFavorites" : "shareMyList");
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { serverUrl } = useServerUrl();
  const create = useCreateShareLink(kind);
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
      accessibilityLabel={label}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      <Feather name="share-2" size={15} color={colors.brand.light} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    btn: {
      height: 36,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 14,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: t.colors.brand.glow,
      backgroundColor: t.colors.brand.soft,
    },
    pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
    label: {
      ...typography.caption,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.brand.light,
    },
  });
