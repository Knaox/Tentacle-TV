/**
 * Octave mobile — « Partager » une playlist : créer SON lien (un par playlist), l'envoyer par la feuille de
 * partage du système (Messages, WhatsApp, copier…), ou ne plus partager (le lien cesse aussitôt de marcher).
 * Sans lien public réglé sur le serveur, la feuille le dit : le lien ne marche qu'à la maison. Rien de tout
 * cela sans la capacité `music.playlistShare` ni le droit « Partage public » (l'entrée n'est pas offerte).
 */

import { ActivityIndicator, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Link2, Link2Off, Send } from "lucide-react-native";
import { useMusicPlaylistShare } from "@tentacle-tv/api-client";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { BottomSheet } from "@/components/ui";
import { typography, useTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { closePlaylistSheet } from "./playlistSheetStore";
import { OctavePlayButton } from "../../layout/OctavePlayButton";

export function ShareSheet({ playlist }: { playlist: MusicPlaylist }) {
  const { t } = useTranslation("musicShare");
  const theme = useTheme();
  const share = useMusicPlaylistShare(playlist.jellyfinId);
  const link = share.share;
  const send = async (url: string) => {
    try {
      // iOS lit `url` (et propose « Copier ») ; Android ne lit que `message`.
      await Share.share(Platform.OS === "ios" ? { url, title: playlist.name } : { message: url, title: playlist.name });
    } catch {
      // La feuille du système refermée sans rien choisir : rien à dire.
    }
  };
  const create = async () => {
    const made = await share.create();
    if (!made) return;
    haptic("success");
    void send(made.url);
  };
  const revoke = () => {
    haptic("commit");
    void share.revoke();
  };
  return (
    <BottomSheet
      visible
      onClose={closePlaylistSheet}
      snapPoints={[0.62, 0.9]}
      header={
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: theme.colors.brand.soft }]}>
            <Link2 size={20} color={theme.colors.brand.accentLight} />
          </View>
          <Text numberOfLines={2} style={[typography.subtitle, styles.flex, { color: theme.colors.text.primary }]}>{t("title", { name: playlist.name })}</Text>
        </View>
      }
    >
      <View style={styles.body}>
        <Text style={[typography.body, { color: theme.colors.text.secondary }]}>{t("intro")}</Text>
        {share.loading ? <ActivityIndicator color={theme.colors.brand.accentLight} style={styles.spin} /> : null}
        {link ? (
          <>
            <View style={[styles.link, { backgroundColor: theme.colors.fill.subtle, borderColor: theme.colors.border.subtle }]}>
              <Text selectable numberOfLines={2} style={[typography.caption, { color: theme.colors.text.primary, fontFamily: "Menlo" }]}>{link.url}</Text>
            </View>
            {link.reach === "local" ? (
              <Text style={[typography.caption, styles.warn, { color: theme.colors.statusPairs.warning.fg, backgroundColor: theme.colors.statusPairs.warning.bg }]}>{t("localOnly")}</Text>
            ) : null}
            <OctavePlayButton label={t("shareSheet")} Icon={Send} onPress={() => void send(link.url)} />
            <Pressable onPress={revoke} disabled={share.busy !== null} accessibilityRole="button" style={({ pressed }) => [styles.secondary, { opacity: share.busy ? 0.5 : pressed ? 0.7 : 1 }]}>
              <Link2Off size={18} color={theme.colors.status.error} />
              <Text style={[typography.bodyBold, { color: theme.colors.status.error }]}>{share.busy === "revoke" ? t("revoking") : t("revoke")}</Text>
            </Pressable>
            <Text style={[typography.small, { color: theme.colors.text.tertiary, textAlign: "center" }]}>{t("revokeHint")}</Text>
          </>
        ) : !share.loading ? (
          <OctavePlayButton label={share.busy === "create" ? t("creating") : t("create")} Icon={Link2} onPress={() => void create()} disabled={share.busy !== null} />
        ) : null}
        {share.failed ? (
          <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: theme.colors.status.error }]}>
            {t("failed")}
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 10 },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  body: { paddingHorizontal: 20, paddingBottom: 28, gap: 14 },
  spin: { marginVertical: 12 },
  link: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  warn: { borderRadius: 10, padding: 10, overflow: "hidden" },
  secondary: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
