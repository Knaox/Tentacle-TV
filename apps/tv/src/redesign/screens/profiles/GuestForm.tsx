import { memo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import LinearGradient from "react-native-linear-gradient";
import { useTranslation } from "react-i18next";
import { FAMILY_GUEST_NAME_MAX, FAMILY_PROFILE_COLORS, type FamilyProfileColor } from "@tentacle-tv/shared";
import { GUEST_COLORS_GROUP, GUEST_CREATE_KEY, GUEST_NAME_KEY, guestColorKey } from "@tentacle-tv/tv-core";
import { PillButton } from "../../controls/PillButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { Icon } from "../../icons/Icon";
import { colors, fonts, text, white } from "../../theme/tokens";
import { PairingField } from "../pairing/PairingField";
import { ProfileAvatar } from "./ProfileAvatar";
import { profileStops } from "./profileColors";

/**
 * Créer un invité : son prénom au clavier de l'Apple TV (OK sur le champ),
 * sa couleur parmi les huit du contrat, et l'aperçu de son rond qui suit les
 * deux. « Créer le profil » envoie ; le serveur crée le compte (caché, sans
 * mot de passe connu) et nettoie le nom.
 *
 * Clés : `guest:name`, `guest:color:<couleur>`, `guest:create` ; groupe
 * `guest:colors`.
 */
export const GuestForm = memo(function GuestForm({ name, color, creating, error, onName, onColor, onSubmit }: {
  name: string;
  color: FamilyProfileColor;
  creating: boolean;
  error: string | null;
  onName?: (name: string) => void;
  onColor?: (color: FamilyProfileColor) => void;
  onSubmit?: () => void;
}) {
  const { t } = useTranslation("familyTv");
  return (
    <View style={styles.root}>
      <View style={styles.form}>
        <Text style={styles.explain}>{t("guest.explain")}</Text>
        <PairingField
          focusKey={GUEST_NAME_KEY}
          icon="user"
          label={t("guest.nameLabel")}
          caption
          value={name}
          placeholder={t("guest.namePlaceholder")}
          keyboard={{ returnKeyType: "done", textContentType: "givenName", autoComplete: "off" }}
          onChangeText={(next) => onName?.(next.slice(0, FAMILY_GUEST_NAME_MAX))}
        />
        <Text style={styles.caption}>{t("guest.colorLabel")}</Text>
        <FocusGroup focusKey={GUEST_COLORS_GROUP} style={styles.swatches}>
          {FAMILY_PROFILE_COLORS.map((swatch) => (
            <Swatch key={swatch} color={swatch} selected={swatch === color} label={t(`colors.${swatch}`)} onPress={onColor ? () => onColor(swatch) : undefined} />
          ))}
        </FocusGroup>
        <View style={styles.submit}>
          <PillButton label={creating ? t("guest.creating") : t("guest.create")} icon="check" variant="primary" focusKey={GUEST_CREATE_KEY} onPress={creating ? undefined : onSubmit} />
          {creating ? <ActivityIndicator color={colors.text} /> : null}
        </View>
        <Text style={styles.error}>{error ?? " "}</Text>
      </View>
      <View style={styles.preview}>
        <ProfileAvatar name={name.trim() || t("guest.namePlaceholder")} color={color} size={260} />
        <Text style={styles.previewName} numberOfLines={1}>{name.trim() || " "}</Text>
      </View>
    </View>
  );
});

const SWATCH = 76;

const Swatch = memo(function Swatch({ color, selected, label, onPress }: {
  color: FamilyProfileColor;
  selected: boolean;
  label: string;
  onPress?: () => void;
}) {
  return (
    <FocusTarget focusKey={guestColorKey(color)} onPress={onPress} accessibilityLabel={label}>
      {(focused) => <SwatchBody color={color} selected={selected} focused={focused} />}
    </FocusTarget>
  );
});

function SwatchBody({ color, selected, focused }: { color: FamilyProfileColor; selected: boolean; focused: boolean }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.16 * p.value }] }));
  const [from, to] = profileStops(color);
  return (
    <Animated.View style={[styles.swatch, selected ? styles.swatchSelected : null, lift]}>
      <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.swatchFill}>
        {selected ? <Icon name="check" size={34} color="#fff" strokeWidth={3} /> : null}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: "row", gap: 90, alignItems: "flex-start" },
  form: { flexShrink: 1 },
  explain: { ...text.body, maxWidth: 1100, marginBottom: 34 },
  caption: {
    ...fonts.bold,
    fontSize: 22,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.textTertiary,
    marginTop: 38,
    marginBottom: 16,
    marginLeft: 8,
  },
  swatches: { flexDirection: "row", gap: 24 },
  swatch: { width: SWATCH, height: SWATCH, borderRadius: SWATCH / 2, borderWidth: 3, borderColor: "transparent" },
  swatchSelected: { borderColor: white(0.9) },
  swatchFill: { flex: 1, borderRadius: SWATCH / 2, alignItems: "center", justifyContent: "center" },
  submit: { flexDirection: "row", alignItems: "center", gap: 20, marginTop: 46 },
  error: { ...fonts.semibold, fontSize: 26, lineHeight: 34, marginTop: 18, color: colors.warningFg },
  preview: { alignItems: "center", paddingTop: 70 },
  previewName: { ...text.heading, marginTop: 28, maxWidth: 360, textAlign: "center" },
});
