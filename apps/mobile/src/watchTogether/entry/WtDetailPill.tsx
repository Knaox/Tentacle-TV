import { memo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react-native";
import { useWatchTogetherOrIdle } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { showToast } from "@/notices/toastStore";
import { FONT_FAMILY, RADIUS, spacing, useTheme } from "@/theme";
import { openWtSheet } from "../wtSheets";

/**
 * « Regarder ensemble » sur la fiche — une pilule SECONDAIRE sous la
 * bande-annonce, même gabarit (la rangée d'actions est en quatre colonnes
 * fixes). La règle du web (`DetailActionCapsule`) : hors groupe, elle crée
 * le groupe avec CE titre au programme et ouvre sa feuille ; l'hôte d'un
 * groupe y invite ; un groupe en cours sur un AUTRE appareil du compte :
 * « Rejoindre ici » (jamais un second groupe). Un membre qui n'est pas l'hôte, un compte « rejoindre
 * seulement » ou sans Watch Together : rien.
 */
export const WtDetailPill = memo(function WtDetailPill({ item, animStyle }: {
  item: MediaItem;
  animStyle?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation("watchTogether");
  const { colors } = useTheme();
  const { isInGroup, isHost, mayCreate, elsewhere, actions } = useWatchTogetherOrIdle();
  const [busy, setBusy] = useState(false);
  if (item.Type === "BoxSet" || !mayCreate || (isInGroup && !isHost)) return null;

  const press = (): void => {
    if (isInGroup) { openWtSheet("invite"); return; }
    setBusy(true);
    if (elsewhere) {
      actions.joinHere().then(
        () => setBusy(false),
        () => { setBusy(false); showToast({ title: t("elsewhereJoinFailed") }); },
      );
      return;
    }
    actions.create(item.Id).then(
      () => { setBusy(false); openWtSheet("room"); },
      () => { setBusy(false); showToast({ title: t("alreadyInGroup") }); },
    );
  };
  const label = isInGroup ? t("inviteMembers") : elsewhere ? t("elsewhereJoinHere") : t("watchTogetherAction");

  return (
    <Animated.View style={[{ marginTop: spacing.md, alignItems: "center" }, animStyle]}>
      <Pressable
        onPress={press}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ busy }}
        style={({ pressed }) => [st.pill, { backgroundColor: colors.fill.subtle, borderColor: colors.border.subtle }, pressed && st.pressed]}
        testID="wt-detail-action"
      >
        {busy ? <ActivityIndicator size="small" color={colors.text.primary} /> : <Users size={18} color={colors.text.primary} />}
        <Text numberOfLines={1} style={[st.label, { color: colors.text.primary }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
});

const st = StyleSheet.create({
  pill: {
    width: "100%", maxWidth: 420, height: 48, borderRadius: RADIUS.pill, borderWidth: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 20,
  },
  pressed: { opacity: 0.7 },
  label: { fontSize: 15, fontFamily: FONT_FAMILY.semibold, letterSpacing: 0.2, flexShrink: 1 },
});
