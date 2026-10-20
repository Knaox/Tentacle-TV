import { useState, useRef } from "react";
import { Pressable, Text, StyleSheet, Share, Platform, View, findNodeHandle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useCreateShareLink, type ShareListKind } from "@tentacle-tv/api-client";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { FONT_FAMILY, useTheme } from "@/theme";
import { MIN_TARGET, useButtonLook } from "@/components/ui/buttons";

/**
 * « Partager ma liste » ou « Partager mes titres likés » (mobile) — génère le
 * lien de partage et ouvre la feuille de partage native. Le lien ouvre la page
 * web /share/:token, la même pour les deux listes.
 *
 * Un petit bouton SECONDAIRE du système (`useButtonLook`, capsule grise sur
 * iOS, contour fin sur Android) : repérable sous le titre sans tirer l'œil —
 * la couleur reste aux actions principales. `Pressable` maison pour garder la
 * référence d'ancrage du popover iPad.
 */
export function ShareMyListButton({ kind = "watchlist" }: { kind?: ShareListKind }) {
  const { t } = useTranslation("common");
  const label = t(kind === "likes" ? "shareMyFavorites" : "shareMyList");
  const theme = useTheme();
  const look = useButtonLook("secondary", "sm");
  const slop = Math.ceil((MIN_TARGET[Platform.OS === "android" ? "android" : "ios"] - look.height) / 2);
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
      hitSlop={{ top: slop, bottom: slop }}
      android_ripple={{ color: theme.colors.fill.medium, foreground: true }}
      style={({ pressed }) => [styles.btn, look.shape, pressed && Platform.OS === "ios" && styles.pressed]}
    >
      <Feather name="share-2" size={look.iconSize} color={look.fg} />
      <Text style={[styles.label, { color: look.fg, fontSize: look.fontSize }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", gap: 6, overflow: "hidden" },
  pressed: { opacity: 0.7 },
  label: { fontFamily: FONT_FAMILY.semibold },
});
