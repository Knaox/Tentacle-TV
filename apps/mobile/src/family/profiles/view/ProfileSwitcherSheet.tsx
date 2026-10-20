import { useEffect, useMemo } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { pickerShowsPinLock, type PickedProfileDto, type PickerProfilesDto } from "@tentacle-tv/shared";
import { retainModal } from "@/components/ui/modalGate";
import { FONT_FAMILY, IS_TABLET_DEVICE, RADIUS, SHEET_MAX_WIDTH, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { MODAL_ORIENTATIONS } from "../../modalOrientations";
import { usePickFlow } from "../usePickFlow";
import { usePickerPick } from "../usePickerPick";
import { PinPad } from "./PinPad";
import { ProfileTile } from "./ProfileTile";

interface ProfileSwitcherSheetProps {
  listing: PickerProfilesDto | undefined;
  /** « Gérer les profils » : en session personnelle seulement (absent sinon). */
  onManage?: () => void;
  onPicked: (picked: PickedProfileDto) => void;
  onStale: () => void;
  onClose: () => void;
}

/**
 * La feuille « Changer de profil » (consigne de Damien, 20/10 : « je clique
 * sur mon nom et bam, on propose un autre profil ») — ouverte par la puce de
 * l'en-tête, Réglages › Compte et l'onglet Profil. Les profils en tuiles, le
 * profil actuel marqué et rouvert sans code, le cadenas sur ceux qui en ont un ;
 * le pavé du code DANS la feuille (« ‹ Profils »). En bas sur le téléphone,
 * centrée et bornée sur l'iPad. Une modale à la fois (`modalGate`).
 */
export function ProfileSwitcherSheet({ listing, onManage, onPicked, onStale, onClose }: ProfileSwitcherSheetProps) {
  const { t } = useTranslation(["profilePicker", "familyMobile"]);
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const pick = usePickerPick();
  const profiles = useMemo(() => listing?.profiles ?? [], [listing]);
  const opensWithoutPin = useMemo(() => (listing ? [listing.currentProfileId] : []), [listing]);
  const flow = usePickFlow({ profiles, opensWithoutPin, pick, onPicked, onStale });
  const busy = flow.opening !== null;

  useEffect(() => retainModal(), []);

  return (
    <Modal visible transparent animationType={IS_TABLET_DEVICE ? "fade" : "slide"} statusBarTranslucent
      supportedOrientations={[...MODAL_ORIENTATIONS]} onRequestClose={() => (flow.pin ? flow.back() : onClose())}>
      <View style={[st.scrim, IS_TABLET_DEVICE ? st.scrimCentered : st.scrimBottom]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} accessibilityLabel={t("familyMobile:switcher.close")} />
        <View style={[st.sheet, IS_TABLET_DEVICE ? st.sheetTablet : { paddingBottom: insets.bottom + spacing.lg }]} accessibilityViewIsModal>
          {!IS_TABLET_DEVICE ? <View style={st.grabber} /> : null}
          {flow.pin ? (
            <View>
              <Pressable onPress={flow.back} disabled={busy} accessibilityRole="button" style={({ pressed }) => [st.back, pressed && st.pressed]}>
                <Feather name="chevron-left" size={18} color={theme.colors.text.secondary} />
                <Text style={st.backText}>{t("familyMobile:switcher.back")}</Text>
              </Pressable>
              <PinPad pin={flow.pin} onDigit={flow.digit} onErase={flow.erase} onBack={flow.back} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={st.content} bounces={false}>
              <Text style={st.title} accessibilityRole="header">{t("profilePicker:switcher.title")}</Text>
              <Text style={st.subtitle}>{t("profilePicker:whoIsWatching")}</Text>
              {listing ? (
                <View style={st.grid}>
                  {profiles.map((profile) => (
                    <ProfileTile
                      key={profile.userId}
                      profile={profile}
                      locked={pickerShowsPinLock(profile, opensWithoutPin)}
                      current={profile.userId === listing.currentProfileId}
                      opening={flow.opening === profile.userId}
                      disabled={busy}
                      onPress={flow.choose}
                    />
                  ))}
                </View>
              ) : (
                <ActivityIndicator style={st.loading} color={theme.colors.text.secondary} />
              )}
              {flow.notice ? <Text style={st.notice} accessibilityLiveRegion="polite">{flow.notice}</Text> : null}
              {onManage ? (
                <Pressable onPress={onManage} disabled={busy} accessibilityRole="button" style={({ pressed }) => [st.manage, pressed && st.pressed]}>
                  <Feather name="users" size={18} color={theme.colors.text.secondary} />
                  <Text style={st.manageText}>{t("profilePicker:manageProfiles")}</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    scrim: { flex: 1, backgroundColor: t.colors.overlay.scrimHeavy },
    scrimBottom: { justifyContent: "flex-end" },
    scrimCentered: { justifyContent: "center", alignItems: "center", padding: spacing.lg },
    sheet: {
      width: "100%",
      maxHeight: "88%",
      backgroundColor: t.colors.surface.s1,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      ...t.colors.shadow.sheet,
    },
    sheetTablet: { maxWidth: SHEET_MAX_WIDTH, borderRadius: RADIUS.xl, paddingVertical: spacing.xl },
    grabber: { alignSelf: "center", width: 36, height: 5, borderRadius: 3, backgroundColor: t.colors.fill.medium, marginBottom: spacing.md },
    content: { alignItems: "center", paddingBottom: spacing.md },
    title: { ...typography.title, color: t.colors.text.primary, textAlign: "center" },
    subtitle: { ...typography.body, color: t.colors.text.secondary, textAlign: "center", marginTop: 2, marginBottom: spacing.lg },
    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.sm },
    loading: { marginVertical: spacing.xl },
    notice: { ...typography.body, color: t.colors.status.error, textAlign: "center", marginTop: spacing.md },
    manage: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: RADIUS.lg },
    manageText: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
    back: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, alignSelf: "flex-start", paddingHorizontal: spacing.sm, borderRadius: RADIUS.lg },
    backText: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
    pressed: { backgroundColor: t.colors.fill.subtle },
  });
