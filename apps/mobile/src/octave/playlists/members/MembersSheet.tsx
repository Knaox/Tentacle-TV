/**
 * Octave mobile — la feuille des PERSONNES d'une playlist partagée entre comptes (capacité
 * `music.playlistMembers`), le pendant de `PlaylistMembersDialog` du bureau. Le propriétaire y donne la playlist à
 * un compte du serveur avec un droit, le change, le retire ; un membre y voit qui y a accès et peut la QUITTER
 * (confirmé). Le serveur décide de tout.
 */

import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useTranslation } from "react-i18next";
import { LogOut, Plus, Users } from "lucide-react-native";
import { useMusicPlaylistMembers, useMusicShareCandidates } from "@tentacle-tv/api-client";
import type { MusicPlaylist, MusicPlaylistMemberRight } from "@tentacle-tv/shared/music";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import { BottomSheet } from "@/components/ui";
import { typography, useTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { closePlaylistSheet } from "../sheets/playlistSheetStore";
import { MemberRow, PersonRow, RightChoices } from "./MemberRows";

export function MembersSheet({ playlist }: { playlist: MusicPlaylist }) {
  const { t } = useTranslation("musicPlaylistMembers");
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const members = useMusicPlaylistMembers(playlist.jellyfinId);
  const sharing = members.sharing;
  const owner = sharing?.role === "owner";
  const candidates = useMusicShareCandidates(owner);
  const [newRight, setNewRight] = useState<MusicPlaylistMemberRight>("add");
  const taken = new Set(sharing?.members.map((m) => m.userId) ?? []);
  const free = (candidates.candidates ?? []).filter((c) => !taken.has(c.userId));
  const busy = members.busy !== null;
  const muted = { color: theme.colors.text.tertiary };

  const leave = () =>
    Alert.alert(t("leaveTitle", { name: playlist.name }), t("leaveMessage", { owner: sharing?.owner.name ?? "" }), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("leaveConfirm"),
        style: "destructive",
        onPress: () => {
          haptic("destructive");
          void members.leave().then((left) => {
            if (!left) return;
            closePlaylistSheet();
            if (pathname === octavePaths.playlist(playlist.jellyfinId)) router.back();
          });
        },
      },
    ]);

  return (
    <BottomSheet
      visible
      onClose={closePlaylistSheet}
      snapPoints={[0.62, 0.92]}
      header={
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: theme.colors.brand.soft }]}>
            <Users size={20} color={theme.colors.brand.accentLight} />
          </View>
          <Text numberOfLines={2} style={[typography.subtitle, styles.flex, { color: theme.colors.text.primary }]}>
            {owner ? t("title", { name: playlist.name }) : t("peopleTitle", { name: playlist.name })}
          </Text>
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.body}>
        {owner ? <Text style={[typography.body, { color: theme.colors.text.secondary }]}>{t("intro")}</Text> : null}
        {members.loading ? <ActivityIndicator color={theme.colors.brand.accentLight} style={styles.spin} /> : null}
        {members.unreadable ? <Text style={[typography.caption, muted]}>{t("unavailable")}</Text> : null}
        {sharing ? (
          <View>
            <Text style={[typography.small, styles.section, muted]}>{t("members")}</Text>
            {!owner ? <PersonRow person={sharing.owner} caption={t("owner")} /> : null}
            {sharing.members.map((m) =>
              owner ? (
                <MemberRow key={m.userId} person={m} right={m.right} disabled={busy} onRight={(r) => void members.setRight(m.userId, r)} onRemove={() => void members.remove(m.userId)} />
              ) : (
                <PersonRow key={m.userId} person={m} caption={t(`rights.${m.right}`)} />
              ),
            )}
            {owner && sharing.members.length === 0 ? <Text style={[typography.caption, muted]}>{t("empty")}</Text> : null}
          </View>
        ) : null}

        {owner ? (
          <View>
            <Text style={[typography.small, styles.section, muted]}>{t("addTitle")}</Text>
            <Text style={[typography.caption, muted]}>{t("addAs")}</Text>
            <RightChoices value={newRight} onChange={setNewRight} disabled={busy} />
            {candidates.loading ? <ActivityIndicator color={theme.colors.brand.accentLight} style={styles.spin} /> : null}
            {candidates.candidates && free.length === 0 ? <Text style={[typography.caption, muted]}>{t("noCandidates")}</Text> : null}
            {free.map((person) => (
              <PersonRow
                key={person.userId}
                person={person}
                right={
                  <Pressable
                    disabled={busy}
                    onPress={() => {
                      haptic("commit");
                      void members.add(person.userId, newRight);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t("addPerson", { name: person.name })}
                    style={({ pressed }) => [styles.add, { backgroundColor: pressed ? theme.colors.fill.medium : theme.colors.fill.soft, opacity: busy ? 0.5 : 1 }]}
                  >
                    <Plus size={20} color={theme.colors.text.primary} />
                  </Pressable>
                }
              />
            ))}
          </View>
        ) : null}

        {members.failed ? (
          <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: theme.colors.status.error }]}>
            {t("failed")}
          </Text>
        ) : null}
        {sharing?.role === "member" ? (
          <Pressable onPress={leave} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.leave, { opacity: busy ? 0.5 : pressed ? 0.7 : 1 }]}>
            <LogOut size={18} color={theme.colors.status.error} />
            <Text style={[typography.bodyBold, { color: theme.colors.status.error }]}>{t("leave")}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 10 },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  body: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
  spin: { marginVertical: 12 },
  section: { textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  add: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  leave: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
