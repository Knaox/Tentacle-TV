import { useState, type ReactNode } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MessageInput } from "@/hooks/admin/useAdminSessions";
import { MessageBanner } from "@/session/MessageBanner";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";

const TEXT_MAX = 1_000;
const HEADER_MAX = 100;
const DURATIONS = [
  { value: null, key: "durationUntilClosed" },
  { value: 10_000, key: "duration10" },
  { value: 30_000, key: "duration30" },
  { value: 60_000, key: "duration60" },
] as const;
type Duration = (typeof DURATIONS)[number]["value"];

/**
 * La rédaction d'un message à une session — ou à tout un groupe Watch
 * Together —, dans une feuille : « Annuler » et « Envoyer » dans l'en-tête,
 * le destinataire dessous (on sait à QUI et sur QUEL appareil on écrit), la
 * durée d'un geste, et l'APERÇU du bandeau tel que la personne le verra.
 * Un échec s'affiche ici, et le texte n'est pas perdu.
 *
 * Par défaut, « jusqu'à fermeture » : un message d'administrateur est fait
 * pour être lu.
 */
export function MessageComposer({ title, recipient, previewName, pending, failed, onSend, onClose }: {
  title: string;
  recipient: ReactNode;
  previewName: string | null;
  pending: boolean;
  failed: boolean;
  onSend: (input: MessageInput) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("sessions");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [header, setHeader] = useState("");
  const [text, setText] = useState("");
  const [duration, setDuration] = useState<Duration>(null);
  const empty = text.trim().length === 0;
  const sheet = Platform.OS === "ios";

  const submit = () => {
    if (empty || pending) return;
    onSend({ header: header.trim(), text: text.trim(), ...(duration === null ? {} : { timeoutMs: duration }) });
  };

  return (
    <Modal visible animationType="slide" presentationStyle={sheet ? "pageSheet" : "fullScreen"} onRequestClose={onClose}>
      <KeyboardAvoidingView style={st.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[st.bar, { paddingTop: sheet ? spacing.md : Math.max(insets.top, spacing.md) }]}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" style={st.barBtn}>
            <Text style={st.cancel}>{t("cancel")}</Text>
          </Pressable>
          <Text style={st.barTitle} numberOfLines={1} accessibilityRole="header">{title}</Text>
          <Pressable
            onPress={submit}
            disabled={empty || pending}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityState={{ disabled: empty, busy: pending }}
            style={[st.barBtn, st.barBtnEnd]}
          >
            {pending
              ? <ActivityIndicator size="small" color={theme.colors.brand.light} />
              : <Text style={[st.send, empty && st.sendOff]}>{t("send")}</Text>}
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[st.body, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={st.recipient}>{recipient}</View>

          <Text style={st.label}>{t("composerHeader")}</Text>
          <TextInput
            value={header}
            onChangeText={setHeader}
            maxLength={HEADER_MAX}
            style={st.input}
            placeholderTextColor={theme.colors.text.quaternary}
            accessibilityLabel={t("composerHeader")}
            returnKeyType="next"
          />

          <Text style={st.label}>{t("composerText")}</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            maxLength={TEXT_MAX}
            multiline
            autoFocus
            style={[st.input, st.textarea]}
            accessibilityLabel={t("composerText")}
            textAlignVertical="top"
          />
          <Text style={st.counter}>{text.length} / {TEXT_MAX}</Text>

          <Text style={st.label}>{t("composerDuration")}</Text>
          <View style={st.durations} accessibilityRole="radiogroup">
            {DURATIONS.map((d) => {
              const active = duration === d.value;
              return (
                <Pressable
                  key={d.key}
                  onPress={() => setDuration(d.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={[st.duration, active && st.durationActive]}
                >
                  <Text style={[st.durationTxt, active && st.durationTxtActive]}>{t(d.key)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={st.label}>{previewName ? t("composerPreviewFor", { name: previewName }) : t("composerPreview")}</Text>
          <View style={empty ? st.previewEmpty : undefined}>
            <MessageBanner
              header={header.trim()}
              text={text.trim() || t("composerPreviewEmpty")}
              durationMs={duration}
              still
            />
          </View>

          {failed && (
            <View style={st.failed} accessibilityRole="alert">
              <Feather name="alert-circle" size={16} color={theme.colors.statusPairs.error.fg} />
              <Text style={st.failedTxt}>{t("composerFailed")}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.surface.s0 },
    bar: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.sm,
      paddingHorizontal: spacing.screenPadding,
      paddingBottom: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border.subtle,
    },
    barBtn: { minWidth: 72, minHeight: 36, justifyContent: "center" as const },
    barBtnEnd: { alignItems: "flex-end" as const },
    cancel: { fontSize: 16, fontFamily: FONT_FAMILY.regular, color: t.colors.brand.light },
    barTitle: { flex: 1, textAlign: "center" as const, fontSize: 16, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    send: { fontSize: 16, fontFamily: FONT_FAMILY.bold, color: t.colors.brand.light },
    sendOff: { opacity: 0.4 },
    body: { padding: spacing.screenPadding, gap: 8 },
    recipient: { paddingVertical: spacing.sm, marginBottom: spacing.sm },
    label: { marginTop: spacing.md, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase" as const, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.tertiary },
    input: {
      minHeight: 46,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.surface.s1,
      fontSize: 16,
      fontFamily: FONT_FAMILY.regular,
      color: t.colors.text.primary,
    },
    textarea: { minHeight: 110 },
    counter: { alignSelf: "flex-end" as const, fontSize: 12, fontFamily: FONT_FAMILY.regular, color: t.colors.text.quaternary, fontVariant: ["tabular-nums"] },
    durations: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
    duration: {
      height: 38,
      justifyContent: "center" as const,
      paddingHorizontal: 14,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.subtle,
    },
    durationActive: { borderColor: t.colors.brand.glow, backgroundColor: t.colors.brand.soft },
    durationTxt: { fontSize: 14, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
    durationTxtActive: { color: t.colors.text.primary, fontFamily: FONT_FAMILY.semibold },
    previewEmpty: { opacity: 0.6 },
    failed: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 8,
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: RADIUS.lg,
      backgroundColor: t.colors.statusPairs.error.bg,
    },
    failedTxt: { flex: 1, fontSize: 14, fontFamily: FONT_FAMILY.medium, color: t.colors.statusPairs.error.fg },
  });
