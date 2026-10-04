import { useEffect, type ReactNode } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { retainModal } from "@/components/ui/modalGate";
import { MODAL_ORIENTATIONS } from "@/family/modalOrientations";
import { FONT_FAMILY, SHEET_MAX_WIDTH, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";

interface FamilySheetProps {
  title: string;
  /** « Annuler » ou « Fermer » : le seul geste de gauche. */
  closeLabel: string;
  onClose: () => void;
  /** Le geste qui valide la feuille, à droite (absent : la feuille n'a rien à valider). */
  action?: { label: string; onPress: () => void; disabled?: boolean; pending?: boolean; destructive?: boolean };
  children: ReactNode;
}

/**
 * La feuille d'un geste de la Famille (inviter, créer un invité, code PIN,
 * dissoudre) : une feuille native sur iOS — centrée en carte sur l'iPad —,
 * plein écran sur Android. « Annuler » à gauche, le titre, la validation à
 * droite ; le contenu défile au-dessus du clavier. Une modale à la fois
 * (`modalGate`).
 */
export function FamilySheet({ title, closeLabel, onClose, action, children }: FamilySheetProps) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const sheet = Platform.OS === "ios";
  const pending = action?.pending === true;
  useEffect(() => retainModal(), []);

  const close = () => {
    if (!pending) onClose();
  };

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle={sheet ? "pageSheet" : "fullScreen"}
      supportedOrientations={[...MODAL_ORIENTATIONS]}
      onRequestClose={close}
    >
      <KeyboardAvoidingView style={st.root} behavior={sheet ? "padding" : undefined}>
        <View style={[st.bar, { paddingTop: sheet ? spacing.md : Math.max(insets.top, spacing.md) }]}>
          <Pressable onPress={close} disabled={pending} hitSlop={10} accessibilityRole="button" style={st.barBtn}>
            <Text style={[st.barText, pending && st.off]}>{closeLabel}</Text>
          </Pressable>
          <Text style={st.barTitle} numberOfLines={1} accessibilityRole="header">{title}</Text>
          <View style={[st.barBtn, st.barEnd]}>
            {action ? (
              <Pressable
                onPress={action.onPress}
                disabled={action.disabled || pending}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityState={{ disabled: !!action.disabled || pending, busy: pending }}
                style={st.barAction}
              >
                {pending ? (
                  <ActivityIndicator size="small" color={theme.colors.brand.light} />
                ) : (
                  <Text
                    style={[st.barText, st.actionText, action.destructive && st.destructive, action.disabled && st.off]}
                    numberOfLines={1}
                  >
                    {action.label}
                  </Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[st.body, { paddingBottom: insets.bottom + spacing.xl }]}
        >
          <View style={st.column}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.surface.s0 },
    bar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border.subtle,
    },
    barBtn: { minWidth: 88, minHeight: 44, justifyContent: "center" },
    barEnd: { alignItems: "flex-end" },
    barAction: { minHeight: 44, justifyContent: "center" },
    barTitle: { ...typography.bodyBold, color: t.colors.text.primary, flex: 1, textAlign: "center" },
    barText: { ...typography.body, color: t.colors.text.secondary },
    actionText: { fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
    destructive: { color: t.colors.status.error },
    off: { opacity: 0.4 },
    body: { paddingHorizontal: spacing.screenPadding, paddingTop: spacing.lg },
    // L'iPad en plein écran (Android, Split View) : une colonne lisible.
    column: { width: "100%", maxWidth: SHEET_MAX_WIDTH, alignSelf: "center" },
  });
