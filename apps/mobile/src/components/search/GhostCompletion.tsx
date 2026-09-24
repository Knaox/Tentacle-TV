import { forwardRef, memo } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme";

/**
 * La suite du meilleur titre, en gris, collée à ce qui est tapé — la
 * complétion du bureau (« ⇥ l'accepte »). Posée DERRIÈRE le champ, dans la même
 * boîte, centrée comme lui et dans le même corps de texte : la partie tapée y
 * est transparente, seule la suite se voit, exactement à la place du curseur.
 *
 * `textStyle` : la typographie du champ SANS sa mise en page (ni `flex`, ni
 * marges) — sinon le texte fantôme se cale en haut de la boîte.
 */
export const GhostCompletion = memo(function GhostCompletion({ typed, completion, textStyle }: {
  typed: string;
  completion: string | null;
  textStyle: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  if (!completion) return null;
  return (
    <View pointerEvents="none" style={st.box} accessible={false} importantForAccessibility="no-hide-descendants">
      <Text numberOfLines={1} style={textStyle}>
        <Text style={st.hidden}>{typed}</Text>
        <Text style={{ color: theme.colors.text.quaternary }}>{completion}</Text>
      </Text>
    </View>
  );
});

/**
 * Un champ de recherche et sa complétion fantôme, dans la même boîte : le
 * champ est transparent au-dessus, la suite grise dessous. `textStyle` porte
 * la typographie (police, corps, couleur) ; la boîte prend la place restante.
 */
export const AssistedInput = forwardRef<TextInput, TextInputProps & {
  completion: string | null;
  textStyle: StyleProp<TextStyle>;
}>(function AssistedInput({ completion, textStyle, value, ...props }, ref) {
  return (
    <View style={st.field}>
      <GhostCompletion typed={value ?? ""} completion={completion} textStyle={textStyle} />
      <TextInput ref={ref} value={value} {...props} style={[textStyle, st.input]} />
    </View>
  );
});

/** Le geste qui accepte la complétion — le pendant tactile de ⇥. */
export const AcceptCompletion = memo(function AcceptCompletion({ onAccept }: { onAccept: () => void }) {
  const { t } = useTranslation("search");
  const theme = useTheme();
  return (
    <Pressable onPress={onAccept} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("hintComplete")} style={st.accept}>
      <Feather name="corner-down-right" size={16} color={theme.colors.brand.light} />
    </Pressable>
  );
});

const st = StyleSheet.create({
  field: { flex: 1, justifyContent: "center" },
  input: { padding: 0, margin: 0, backgroundColor: "transparent" },
  box: { ...StyleSheet.absoluteFillObject, justifyContent: "center" },
  hidden: { color: "transparent" },
  accept: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
});
