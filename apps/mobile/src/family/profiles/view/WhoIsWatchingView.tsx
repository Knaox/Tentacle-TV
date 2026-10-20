import { useMemo } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { pickerShowsPinLock, type PickedProfileDto, type PickerProfilesDto } from "@tentacle-tv/shared";
import { CONTENT_MAX_WIDTH, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { usePickFlow } from "../usePickFlow";
import { usePickerPick } from "../usePickerPick";
import { PinPad } from "./PinPad";
import { ProfileTile } from "./ProfileTile";
import { PlainButton } from "@/components/ui/buttons";

export type WhoIsWatchingMode = "launch" | "switch";

interface WhoIsWatchingViewProps {
  listing: PickerProfilesDto | undefined;
  /** `launch` : à l'ouverture, rien d'autre à faire ; `switch` : depuis Réglages, « Annuler » et le profil en cours. */
  mode: WhoIsWatchingMode;
  onPicked: (picked: PickedProfileDto) => void;
  onStale: () => void;
  onCancel?: () => void;
}

/**
 * « Qui regarde ? » du mobile et de l'iPad, en plein écran : les profils de la
 * famille (ceux de la TV, dits par le serveur), puis le pavé du code PIN si le
 * profil en a un. Aucun accès à la gestion des profils ici : elle vit dans
 * Réglages, une fois connecté. Centré, largeur bornée : propre en paysage sur
 * l'iPad comme sur le téléphone.
 */
export function WhoIsWatchingView({ listing, mode, onPicked, onStale, onCancel }: WhoIsWatchingViewProps) {
  const { t } = useTranslation(["profilePicker", "familyMobile"]);
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const pick = usePickerPick();
  const profiles = useMemo(() => listing?.profiles ?? [], [listing]);
  // Depuis Réglages, le profil en cours se rouvre sans son code : on y est déjà.
  const opensWithoutPin = useMemo(() => (mode === "switch" && listing ? [listing.currentProfileId] : []), [mode, listing]);
  const flow = usePickFlow({ profiles, opensWithoutPin, pick, onPicked, onStale });

  return (
    <View style={[st.page, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <LinearGradient pointerEvents="none" colors={[theme.colors.brand.glow, "transparent"]} style={st.halo} />
      <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">
        <View style={st.column}>
          {flow.pin ? (
            <PinPad pin={flow.pin} onDigit={flow.digit} onErase={flow.erase} onBack={flow.back} />
          ) : (
            <>
              <Text style={st.title} accessibilityRole="header">{t("profilePicker:whoIsWatching")}</Text>
              {listing ? (
                <View style={st.grid}>
                  {profiles.map((profile) => (
                    <ProfileTile
                      key={profile.userId}
                      profile={profile}
                      locked={pickerShowsPinLock(profile, opensWithoutPin)}
                      current={mode === "switch" && profile.userId === listing.currentProfileId}
                      opening={flow.opening === profile.userId}
                      disabled={flow.opening !== null}
                      onPress={flow.choose}
                    />
                  ))}
                </View>
              ) : (
                <View style={st.loading}>
                  <ActivityIndicator color={theme.colors.text.secondary} />
                  <Text style={st.caption}>{t("familyMobile:launch.loading")}</Text>
                </View>
              )}
              {flow.notice ? <Text style={st.notice} accessibilityLiveRegion="polite">{flow.notice}</Text> : null}
              <Text style={st.caption}>{t(mode === "switch" ? "familyMobile:launch.switchCaption" : "familyMobile:launch.caption")}</Text>
              {onCancel ? (
                <PlainButton label={t("familyMobile:launch.cancel")} onPress={onCancel} disabled={flow.opening !== null} style={st.cancel} />
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: t.colors.surface.s0 },
    halo: { position: "absolute", left: 0, right: 0, top: 0, height: 260, opacity: 0.5 },
    scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
    column: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center", alignItems: "center" },
    title: { ...typography.hero, color: t.colors.text.primary, textAlign: "center", marginBottom: spacing.xl },
    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.md },
    loading: { alignItems: "center", gap: spacing.sm, minHeight: 140, justifyContent: "center" },
    notice: { ...typography.body, color: t.colors.status.error, textAlign: "center", marginTop: spacing.lg },
    caption: { ...typography.small, color: t.colors.text.tertiary, textAlign: "center", marginTop: spacing.xl, maxWidth: 420 },
    cancel: { marginTop: spacing.lg },
    pressed: { backgroundColor: t.colors.fill.subtle },
  });
