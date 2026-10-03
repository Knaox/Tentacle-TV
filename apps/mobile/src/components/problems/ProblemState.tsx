import { memo, useEffect } from "react";
import { AccessibilityInfo, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ProblemActionKey, ProblemModel } from "@tentacle-tv/shared";
import { CryingTentacle } from "@/components/CryingTentacle";
import { spacing, useTheme } from "@/theme";
import { ProblemPanel } from "./ProblemPanel";
import { useProblemText } from "./useProblemText";

interface Props {
  model: ProblemModel;
  onAction: (key: ProblemActionKey) => void;
  busy?: ProblemActionKey | null;
  /** Dans une page qui garde son en-tête : sans plein écran ni marge haute. */
  embedded?: boolean;
}

/**
 * Une page qui n'a pas pu s'afficher — comme l'écran d'erreur de l'Apple
 * TV : la pieuvre qui pleure, le message (quoi, pourquoi, quoi faire,
 * détails), centré, à largeur de lecture. Jamais une page noire, vide ou
 * qui charge pour toujours : chaque échec y a ses gestes.
 */
export const ProblemState = memo(function ProblemState({ model, onAction, busy = null, embedded = false }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const text = useProblemText(model);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(text.announcement);
  }, [text.announcement]);
  return (
    <ScrollView
      style={embedded ? st.embedded : [st.root, { backgroundColor: theme.colors.surface.s0 }]}
      contentContainerStyle={[st.content, !embedded && {
        paddingTop: Math.max(insets.top, 24) + 56,
        paddingBottom: Math.max(insets.bottom, 16) + spacing.xl,
      }]}
    >
      <View style={st.mascot} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <CryingTentacle size={96} />
      </View>
      <ProblemPanel model={model} tone="page" align="center" onAction={onAction} busy={busy} />
    </ScrollView>
  );
});

const st = StyleSheet.create({
  root: { flex: 1 },
  embedded: { flexGrow: 0 },
  content: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.screenPadding, gap: spacing.lg },
  mascot: { alignItems: "center" },
});
