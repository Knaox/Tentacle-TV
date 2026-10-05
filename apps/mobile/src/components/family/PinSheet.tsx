import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSetFamilyGuestPin, useSetOwnFamilyPin } from "@tentacle-tv/api-client";
import { FAMILY_PIN_LENGTH, isValidPin, type FamilyProfileDto, type SetOwnPinBody } from "@tentacle-tv/shared";
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
  /** `currentPin` : le code en place, quand `requireCurrent` le demande. */
  onSubmit: (pin: string | null, currentPin?: string) => void;
  /** SON propre code déjà posé : le changer ou le retirer exige l'actuel
   *  (le serveur le vérifie, mêmes essais et même blocage qu'une TV). */
  requireCurrent?: boolean;
  onClose: () => void;
}

/**
 * Poser, changer ou retirer un code PIN — le sien, ou celui d'un invité.
 * Deux saisies identiques de quatre chiffres, masquées (un œil les montre),
 * clavier numérique ; le serveur le hache et le vérifie seul — il n'est
 * jamais relu, gardé sur l'appareil ni mis dans une URL.
 */
function PinSheet({ title, hasPin, pending, error, onSubmit, requireCurrent = false, onClose }: PinSheetProps) {
  const { t } = useTranslation(["familyWeb", "familyMobile", "family"]);
  const theme = useTheme();
  const form = useThemedStyles(makeFamilyFormStyles);
  const st = useThemedStyles(makeStyles);
  const [current, setCurrent] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const pinRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  /** Le code en place, s'il est exigé et bien formé ; sinon l'erreur est dite. */
  const currentOrError = (): { ok: true; value?: string } | { ok: false } => {
    if (!requireCurrent) return { ok: true };
    if (!isValidPin(current)) {
      setLocalError(t("family:pin.currentMissing"));
      return { ok: false };
    }
    return { ok: true, value: current };
  };

  const submit = () => {
    const held = currentOrError();
    if (!held.ok) return;
    const problem = pinEntryProblem(pin, confirm);
    if (problem) return setLocalError(t(problem === "format" ? "familyWeb:pin.format" : "familyWeb:pin.mismatch"));
    setLocalError(null);
    onSubmit(pin, held.value);
  };

  const remove = () => {
    const held = currentOrError();
    if (!held.ok) return;
    setLocalError(null);
    onSubmit(null, held.value);
  };

  const shown = localError ?? error;
  /** Un champ du code : l'actuel, le nouveau, sa confirmation — « suivant » mène au champ d'après. */
  const field = (value: string, onChange: (next: string) => void, label: string, role: "current" | "pin" | "confirm") => {
    const last = role === "confirm";
    const next = role === "current" ? pinRef : confirmRef;
    return (
    <View style={form.group}>
      <Text style={form.label}>{label}</Text>
      <TextInput
        ref={role === "pin" ? pinRef : last ? confirmRef : undefined}
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
        onSubmitEditing={last ? submit : () => next.current?.focus()}
        style={[form.field, st.pin]}
      />
    </View>
    );
  };

  return (
    <FamilySheet
      title={title}
      closeLabel={t("familyWeb:cancel")}
      onClose={onClose}
      action={{ label: t("familyWeb:pin.save"), onPress: submit, pending }}
    >
      <Text style={form.lead}>{t("familyWeb:pin.hint")} {t("familyWeb:pin.effect")}</Text>
      {requireCurrent ? (
        <View>
          {field(current, setCurrent, t("family:pin.currentLabel"), "current")}
          <Text style={form.hint}>{t("family:pin.currentHint")}</Text>
        </View>
      ) : null}
      <View style={st.fields}>
        <View style={st.column}>{field(pin, setPin, t("familyWeb:pin.label"), "pin")}</View>
        <View style={st.column}>{field(confirm, setConfirm, t("familyWeb:pin.confirmLabel"), "confirm")}</View>
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
            <SettingsRow icon="unlock" label={t("familyWeb:myPin.remove")} destructive last disabled={pending} onPress={remove} />
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
        showToast({ title: t(result.hasPin ? "pin.saved" : "pin.removed"), tone: "success" });
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
      // Un code déjà posé ne se change ni ne se retire sans l'actuel.
      requireCurrent={hasPin}
      onSubmit={(pin, currentPin) => {
        flow.reset();
        const body: SetOwnPinBody = { pin, ...(currentPin !== undefined && { currentPin }) };
        setPin.mutate(body, flow.callbacks);
      }}
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
