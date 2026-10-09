import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ProblemActionKey, ProblemModel } from "@tentacle-tv/shared";
import { Button } from "@/components/ui";
import { FONT_FAMILY, PLAYER, RADIUS, spacing, useTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { ProblemDetails, type ProblemTone } from "./ProblemDetails";
import { PROBLEM_ICONS, useProblemText } from "./useProblemText";

interface Props {
  model: ProblemModel;
  tone: ProblemTone;
  align?: "start" | "center";
  onAction: (key: ProblemActionKey) => void;
  /** Le geste en cours (« Réessayer » qui tourne) : son bouton attend, les autres aussi. */
  busy?: ProblemActionKey | null;
  /** Faux sous la mascotte : elle dit déjà qu'il y a un souci. */
  showIcon?: boolean;
}

/**
 * Le message d'erreur, en trois temps — comme sur l'Apple TV : QUOI (le
 * titre), POURQUOI (la cause en mots de spectateur, puis une phrase d'aide),
 * QUOI FAIRE (une à trois actions, la principale d'abord), et les détails
 * repliés. Deux tons : `player`, toujours sombre (sur l'image du titre), et
 * `page`, celui du thème.
 */
export const ProblemPanel = memo(function ProblemPanel({ model, tone, align = "start", onAction, busy = null, showIcon = true }: Props) {
  const text = useProblemText(model);
  const theme = useTheme();
  const player = tone === "player";
  const centered = align === "center";
  // Une coupure qui peut se réparer seule se dit en ambre ; le reste, en rouge.
  const pair = model.transient ? theme.colors.statusPairs.warning : theme.colors.statusPairs.error;
  const chipBg = player ? (model.transient ? PLAYER.warningSoft : PLAYER.errorSoft) : pair.bg;
  const chipFg = player ? (model.transient ? PLAYER.warning : PLAYER.error) : pair.fg;
  const titleColor = player ? PLAYER.text : theme.colors.text.primary;
  const reasonColor = player ? "rgba(255, 255, 255, 0.88)" : theme.colors.text.primary;
  const hintColor = player ? PLAYER.textSecondary : theme.colors.text.secondary;

  return (
    <View style={[st.root, centered && st.rootCentered]}>
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLabel={text.announcement}
        style={[st.head, centered && st.headCentered]}
      >
        {showIcon ? (
          <View style={[st.chip, { backgroundColor: chipBg }]}>
            <Feather name={PROBLEM_ICONS[model.icon]} size={20} color={chipFg} />
          </View>
        ) : null}
        <Text style={[st.title, { color: titleColor }, centered && st.textCenter]}>{text.title}</Text>
        <Text style={[st.reason, { color: reasonColor }, centered && st.textCenter]}>{text.reason}</Text>
        {text.hint ? <Text style={[st.hint, { color: hintColor }, centered && st.textCenter]}>{text.hint}</Text> : null}
      </View>
      <View style={[st.actions, centered && st.actionsCentered]}>
        {text.actions.map((action, index) => {
          const primary = index === 0;
          const waiting = busy === action.key;
          if (!player) {
            return (
              <Button
                key={action.key}
                title={action.label}
                variant={primary ? "primary" : "secondary"}
                loading={waiting}
                disabled={busy !== null && !waiting}
                onPress={() => onAction(action.key)}
              />
            );
          }
          return (
            <Pressable
              key={action.key}
              onPress={() => {
                haptic("tap");
                onAction(action.key);
              }}
              disabled={busy !== null}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              accessibilityState={{ disabled: busy !== null, busy: waiting }}
              style={({ pressed }) => [
                st.pill,
                primary ? st.pillPrimary : st.pillGhost,
                pressed && (primary ? st.pressedPrimary : st.pressedGhost),
                busy !== null && !waiting && st.dimmed,
              ]}
            >
              {waiting ? <ActivityIndicator size="small" color={primary ? PLAYER.textInverse : PLAYER.text} /> : null}
              <Text style={[st.pillTxt, primary ? st.pillTxtPrimary : st.pillTxtGhost]} numberOfLines={1}>{action.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <ProblemDetails lines={text.details} copy={text.copy} tone={tone} align={align} />
    </View>
  );
});

/*
 * Les textes prennent TOUTE la largeur de la colonne (`alignSelf: stretch`) et
 * se centrent par `textAlign` — jamais une boîte rétrécie à leur mesure : dans
 * une colonne centrée, chaque texte valait exactement sa largeur mesurée, et le
 * moindre écart entre la mesure et le dessin (Inter grasse, interlettrage
 * négatif) coupait la fin du titre — « This page couldn't lo ». Seule la
 * pastille de l'icône se centre comme une boîte.
 */
const st = StyleSheet.create({
  root: { alignSelf: "stretch", maxWidth: 560, gap: spacing.md },
  rootCentered: { alignSelf: "center", width: "100%" },
  head: { gap: spacing.sm, alignItems: "flex-start", alignSelf: "stretch" },
  headCentered: { alignItems: "center" },
  chip: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  title: { alignSelf: "stretch", fontSize: 22, lineHeight: 28, fontFamily: FONT_FAMILY.bold, letterSpacing: -0.3 },
  reason: { alignSelf: "stretch", fontSize: 16, lineHeight: 23, fontFamily: FONT_FAMILY.medium },
  hint: { alignSelf: "stretch", fontSize: 14, lineHeight: 20, fontFamily: FONT_FAMILY.regular },
  textCenter: { textAlign: "center" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  actionsCentered: { justifyContent: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: RADIUS.pill,
  },
  pillPrimary: { backgroundColor: PLAYER.text },
  pillGhost: { borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.28)", backgroundColor: "rgba(0, 0, 0, 0.35)" },
  pressedPrimary: { backgroundColor: "rgba(255, 255, 255, 0.85)" },
  pressedGhost: { backgroundColor: "rgba(255, 255, 255, 0.12)" },
  dimmed: { opacity: 0.45 },
  pillTxt: { fontSize: 15, fontFamily: FONT_FAMILY.semibold },
  pillTxtPrimary: { color: PLAYER.textInverse },
  pillTxtGhost: { color: "rgba(255, 255, 255, 0.92)" },
});
