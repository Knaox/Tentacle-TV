import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSetFamilyGuestPin, useSetOwnFamilyPin } from "@tentacle-tv/api-client";
import { FAMILY_PIN_LENGTH, type FamilyProfileDto } from "@tentacle-tv/shared";
import { SettingsRow, SettingsSection } from "@/components/settings";
import { pinDigits, pinEntryProblem } from "@/family/pinInput";
import { useFamilyText } from "@/family/useFamilyText";
import { showToast } from "@/notices/toastStore";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { FamilySheet } from "./FamilySheet";
import { makeFamilyFormStyles } from "./familyFormStyles";

interface PinSheetProps {
  title: string;
  /** Le profil a déjà un code : « Retirer » s'offre aussi. */
  hasPin: boolean;
  pending: boolean;
  /** Le refus du serveur, déjà dit en mots. */
  error: string | null;
  onSubmit: (pin: string | null) => void;
  onClose: () => void;
}

/**
 * Poser, changer ou retirer un code PIN — le sien, ou celui d'un invité.
 * Deux saisies identiques de quatre chiffres, masquées (un œil les montre),
 * clavier numérique ; le serveur le hache et le vérifie seul — il n'est
 * jamais relu, gardé sur l'appareil ni mis dans une URL.
 */
function PinSheet({ title, hasPin, pending, error, onSubmit, onClose }: PinSheetProps) {
  const { t } = useTranslation(["familyWeb", "familyMobile"]);
  const theme = useTheme();
  const form = useThemedStyles(makeFamilyFormStyles);
  const st = useThemedStyles(makeStyles);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const confirmRef = useRef<TextInput>(null);

  const submit = () => {
    const problem = pinEntryProblem(pin, confirm);
    if (problem) return setLocalError(t(problem === "format" ? "familyWeb:pin.format" : "familyWeb:pin.mismatch"));
    setLocalError(null);
    onSubmit(pin);
  };

  const shown = localError ?? error;
  const field = (value: string, onChange: (next: string) => void, label: string, last: boolean) => (
    <View style={form.group}>
      <Text style={form.label}>{label}</Text>
      <TextInput
        ref={last ? confirmRef : undefined}
        value={value}
        onChangeText={(next) => onChange(pinDigits(next))}
        secureTextEntry={!visible}
        keyboardType="number-pad"
        textContentType="none"
        autoComplete="off"
        autoCorrect={false}
        maxLength={FAMILY_PIN_LENGTH}
        editable={!pending}
        accessibilityLabel={label}
        returnKeyType={last ? "done" : "next"}
        onSubmitEditing={last ? submit : () => confirmRef.current?.focus()}
        style={[form.field, st.pin]}
      />
    </View>
  );

  return (
    <FamilySheet
      title={title}
      closeLabel={t("familyWeb:cancel")}
      onClose={onClose}
      action={{ label: t("familyWeb:pin.save"), onPress: submit, pending }}
    >
      <Text style={form.lead}>{t("familyWeb:pin.hint")} {t("familyWeb:pin.effect")}</Text>
      <View style={st.fields}>
        <View style={st.column}>{field(pin, setPin, t("familyWeb:pin.label"), false)}</View>
        <View style={st.column}>{field(confirm, setConfirm, t("familyWeb:pin.confirmLabel"), true)}</View>
      </View>
      <Pressable
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="switch"
        accessibilityState={{ checked: visible }}
        hitSlop={8}
        style={st.toggle}
      >
        <Feather name={visible ? "eye-off" : "eye"} size={16} color={theme.colors.text.secondary} />
        <Text style={st.toggleText}>{t(visible ? "familyMobile:pinHide" : "familyMobile:pinShow")}</Text>
      </Pressable>
      {shown ? <Text style={form.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{shown}</Text> : null}
      {hasPin ? (
        <View style={st.remove}>
          <SettingsSection>
            <SettingsRow icon="unlock" label={t("familyWeb:myPin.remove")} destructive last disabled={pending} onPress={() => onSubmit(null)} />
          </SettingsSection>
        </View>
      ) : null}
    </FamilySheet>
  );
}

/** Le flux commun : un succès se dit, ferme la feuille ; un refus reste sous les champs. */
function usePinFlow(onClose: () => void) {
  const { t } = useTranslation("familyWeb");
  const { errorText } = useFamilyText();
  const [error, setError] = useState<string | null>(null);
  return {
    error,
    callbacks: {
      onSuccess: (result: { hasPin: boolean }) => {
        showToast({ title: t(result.hasPin ? "pin.saved" : "pin.removed") });
        onClose();
      },
      onError: (failure: unknown) => setError(errorText(failure)),
    },
    reset: () => setError(null),
  };
}

/** Mon code PIN (`PUT /api/family/pin`). */
export function OwnPinSheet({ hasPin, onClose }: { hasPin: boolean; onClose: () => void }) {
  const { t } = useTranslation("familyWeb");
  const setPin = useSetOwnFamilyPin();
  const flow = usePinFlow(onClose);
  return (
    <PinSheet
      title={t("pin.titleSelf")}
      hasPin={hasPin}
      pending={setPin.isPending}
      error={flow.error}
      onSubmit={(pin) => { flow.reset(); setPin.mutate(pin, flow.callbacks); }}
      onClose={onClose}
    />
  );
}

/** Le code PIN d'un invité, posé par le propriétaire. */
export function GuestPinSheet({ guest, onClose }: { guest: FamilyProfileDto; onClose: () => void }) {
  const { t } = useTranslation("familyWeb");
  const setPin = useSetFamilyGuestPin();
  const flow = usePinFlow(onClose);
  return (
    <PinSheet
      title={t("pin.titleGuest", { name: guest.name })}
      hasPin={guest.hasPin}
      pending={setPin.isPending}
      error={flow.error}
      onSubmit={(pin) => { flow.reset(); setPin.mutate({ userId: guest.userId, pin }, flow.callbacks); }}
      onClose={onClose}
    />
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    fields: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.md },
    column: { flexGrow: 1, flexBasis: 150 },
    pin: {
      fontFamily: FONT_FAMILY.semibold,
      fontSize: 24,
      letterSpacing: 12,
      textAlign: "center",
      minHeight: 56,
      borderRadius: RADIUS.lg,
    },
    toggle: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2, alignSelf: "flex-start", minHeight: 44 },
    toggleText: { fontFamily: FONT_FAMILY.medium, fontSize: 14, color: t.colors.text.secondary },
    remove: { marginTop: spacing.xl },
  });
