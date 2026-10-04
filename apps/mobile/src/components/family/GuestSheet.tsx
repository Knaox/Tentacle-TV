import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useCreateFamilyGuest } from "@tentacle-tv/api-client";
import {
  FAMILY_GUEST_NAME_MAX,
  FAMILY_PROFILE_COLORS,
  normalizeGuestName,
  profileColorStops,
  type FamilyProfileColor,
} from "@tentacle-tv/shared";
import { ProfileInitial } from "@/family/FamilyAvatar";
import { useFamilyText } from "@/family/useFamilyText";
import { showToast } from "@/notices/toastStore";
import { spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { FamilySheet } from "./FamilySheet";
import { makeFamilyFormStyles } from "./familyFormStyles";

const SWATCH = 44;

/**
 * Créer un profil invité : un prénom et une couleur. Le serveur crée le vrai
 * compte Jellyfin (caché, mot de passe jeté) et la famille au besoin ; le nom
 * est nettoyé ici comme il le sera là-bas (`normalizeGuestName`), pour que
 * l'aperçu dise ce qui sera gardé.
 */
export function GuestSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("familyWeb");
  const theme = useTheme();
  const form = useThemedStyles(makeFamilyFormStyles);
  const st = useThemedStyles(makeStyles);
  const { errorText } = useFamilyText();
  const create = useCreateFamilyGuest();
  const [name, setName] = useState("");
  const [color, setColor] = useState<FamilyProfileColor>("violet");
  const [error, setError] = useState<string | null>(null);
  const cleaned = normalizeGuestName(name);

  const submit = () => {
    if (!cleaned) return;
    setError(null);
    create.mutate(
      { name: cleaned, color },
      {
        onSuccess: (profile) => {
          haptic("success");
          showToast({ title: t("guest.created", { name: profile.name }) });
          onClose();
        },
        onError: (failure) => setError(errorText(failure)),
      },
    );
  };

  return (
    <FamilySheet
      title={t("guest.title")}
      closeLabel={t("cancel")}
      onClose={onClose}
      action={{ label: t("guest.create"), onPress: submit, disabled: !cleaned, pending: create.isPending }}
    >
      <Text style={form.lead}>{t("guest.explain")}</Text>

      <View style={st.identity}>
        <ProfileInitial name={cleaned ?? "?"} color={color} size={64} />
        <View style={st.nameColumn}>
          <Text style={form.label}>{t("guest.nameLabel")}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t("guest.namePlaceholder")}
            placeholderTextColor={theme.colors.text.quaternary}
            maxLength={FAMILY_GUEST_NAME_MAX * 2}
            autoComplete="off"
            autoCorrect={false}
            autoCapitalize="words"
            textContentType="none"
            editable={!create.isPending}
            returnKeyType="done"
            onSubmitEditing={submit}
            accessibilityLabel={t("guest.nameLabel")}
            accessibilityHint={t("guest.nameHint")}
            style={form.field}
          />
          <Text style={form.hint}>{t("guest.nameHint")}</Text>
        </View>
      </View>

      <Text style={[form.label, st.colorLabel]}>{t("guest.colorLabel")}</Text>
      <View style={st.swatches} accessibilityRole="radiogroup" accessibilityLabel={t("guest.colorLabel")}>
        {FAMILY_PROFILE_COLORS.map((option) => {
          const selected = option === color;
          const [from, to] = profileColorStops(option);
          return (
            <Pressable
              key={option}
              onPress={() => { haptic("select"); setColor(option); }}
              disabled={create.isPending}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: create.isPending }}
              accessibilityLabel={t(`guest.colors.${option}`)}
              style={[st.swatchRing, selected && { borderColor: theme.colors.text.primary }]}
            >
              <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.swatch}>
                {selected ? <Feather name="check" size={18} color="#ffffff" /> : null}
              </LinearGradient>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={form.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : null}
    </FamilySheet>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    identity: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    nameColumn: { flex: 1 },
    colorLabel: { marginTop: spacing.xl },
    swatches: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    // L'anneau garde la cible à 52 pt ; le choix se voit sans la couleur (coche).
    swatchRing: {
      width: SWATCH + 8,
      height: SWATCH + 8,
      borderRadius: (SWATCH + 8) / 2,
      borderWidth: 2,
      borderColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    swatch: {
      width: SWATCH,
      height: SWATCH,
      borderRadius: SWATCH / 2,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
  });
